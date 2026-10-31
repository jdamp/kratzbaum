import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiError, get, send, setRequestContext, clearLocalCollection, finishPendingLogout, activityLabels } from './api';
import type { Activity, ActivityType, Bootstrap, Plant, TodayResponse, DueCare, Room } from './api';
import './styles.css';
import { PlantDialog } from './PlantDialog';
import { PlantRoom } from './PlantRoom';
import { CachedImage, PlantPhotos } from './PlantPhotos';
import { useOnline } from './Identification';
import { LoginPage } from './LoginPage';
import { WikipediaReference } from './WikipediaReference';
import { CareEntryDialog, CareRow } from './CareOverview';
import { inRoom, RoomFilter, RoomManager } from './Rooms';
import type { RoomChange } from './Rooms';
import { registerSW } from 'virtual:pwa-register';
import { dateKey, dateOnly, dateTimeInput, everyDays, formatInstant, formatNumber, inputToInstant, InvalidDateTimeError, overdueDays } from './locale';
type PlantList={plants:Plant[]};
type Tab='today'|'plants'|'calendar'|'rooms'|'settings';
const todayISO=(timeZone:string)=>dateKey(new Date(),timeZone);
function App() {
 const online = useOnline();
 const [speciesBusy,setSpeciesBusy] = useState(false);
 const [roomBusy,setRoomBusy] = useState(false);
 const [plants,setPlants] = useState<Plant[]>([]);
 const [today,setToday] = useState<TodayResponse|null>(null);
 const [rooms,setRooms] = useState<Room[]>([]);
 const [roomsUnavailable,setRoomsUnavailable] = useState(true);
 const [selectedRoom,setSelectedRoom] = useState('all');
 const [boot,setBoot] = useState<Bootstrap|null>(null);
 const [query,setQuery] = useState('');
 const [error,setError] = useState('');
 const [loading,setLoading] = useState(true);
 const [dialog,setDialog] = useState(false);
 const [editing,setEditing] = useState<Plant|null>(null);
 const [careEntry,setCareEntry] = useState<{plant:Plant;type:'watering'|'fertilizing'}|null>(null);
 const [revision,setRevision] = useState(0);
 const [tab,setTab] = useState<Tab>(location.pathname.includes('rooms')?'rooms':location.pathname.includes('calendar')?'calendar':location.pathname.includes('plants')?'plants':'today');
 const [plant,setPlant] = useState<Plant|null>(null);
 const [activities,setActivities] = useState<Activity[]>([]);
 const [activityFilter,setActivityFilter] = useState<'all'|ActivityType>('all');
 const [month,setMonth] = useState(new URLSearchParams(location.search).get('month')||'');
 const pendingRecords = useRef(new Set<string>());
 const loadVersion = useRef(0);
 const detailVersion = useRef(0);
 const accessEpoch = useRef(0);
 const identity = useRef('');
 const resetCollection = () => {
  detailVersion.current++;setRoomBusy(false);
  setPlants([]);setToday(null);setRooms([]);setRoomsUnavailable(true);setSelectedRoom('all');
  setPlant(null);setActivities([]);setDialog(false);setEditing(null);setCareEntry(null);setQuery('');setSpeciesBusy(false);
 };
 const refresh = async () => {
  const version = ++loadVersion.current;
  setLoading(true);
  try {
   let b:Bootstrap;
   try {
    b=await get<Bootstrap>('/api/bootstrap');
    if(version!==loadVersion.current)return;
    localStorage.setItem('kratzbaum-context',JSON.stringify({...b,csrf_token:'',offline:false}));
   } catch(e) {
    if(!(e instanceof ApiError)||e.status!==0)throw e;
    const saved=localStorage.getItem('kratzbaum-context');
    if(!saved)throw e;
    b={...JSON.parse(saved) as Bootstrap,csrf_token:'',offline:true};
   }
   if(version!==loadVersion.current)return;
   if(localStorage.getItem('kratzbaum-local-logout')==='1') {
    if(await finishPendingLogout())b={...b,authenticated:false};
    else {
     resetCollection();history.replaceState({},'','/login');
     setBoot({...b,authenticated:false,offline:true});setError('Auf diesem Gerät abgemeldet. Stelle eine Verbindung her, um die Abmeldung abzuschließen.');return;
    }
   }
   const context=b.auth_mode+'-'+b.identity;
   if(identity.current && identity.current!==context){accessEpoch.current++;resetCollection();}
   identity.current=context;
   setBoot(b);setRequestContext(context,b.csrf_token);
   if(!b.authenticated){accessEpoch.current++;resetCollection();if(b.auth_mode==='oidc')history.replaceState({},'','/login');setError('');return;}
   if(location.pathname==='/login'){history.replaceState({},'','/');setTab('today');}
   const reads=await Promise.allSettled([get<PlantList>('/api/plants'),get<TodayResponse>('/api/today'),get<{rooms:Room[]}>('/api/rooms')]);
   if(version!==loadVersion.current)return;
   const [plantRead,todayRead,roomRead]=reads;
   if(plantRead.status==='fulfilled')setPlants(plantRead.value.plants);
   if(todayRead.status==='fulfilled')setToday({...todayRead.value,not_started:todayRead.value.not_started??[]});
   if(roomRead.status==='fulfilled') {
    setRooms(roomRead.value.rooms);setRoomsUnavailable(false);
    setSelectedRoom(current=>current==='all'||current==='unassigned'||roomRead.value.rooms.some(room=>room.id===current)?current:'all');
   } else setRoomsUnavailable(true);
   const failure=[plantRead,todayRead].find(read=>read.status==='rejected');
   setError(failure?.status==='rejected'?(failure.reason instanceof ApiError?failure.reason.message:'Deine Sammlung konnte nicht geladen werden.'):'');
  } catch(e) {if(version===loadVersion.current)setError(e instanceof ApiError?e.message:'Deine Sammlung konnte nicht geladen werden.');}
  finally {if(version===loadVersion.current)setLoading(false);}
 };
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{
  if(!boot?.authenticated)return;
  const match=location.pathname.match(/^\/plants\/([a-f0-9-]{36})$/);
  if(!match)return;
  const epoch=accessEpoch.current, version=++detailVersion.current;
  get<{plant:Plant;activities:Activity[]}>('/api/plants/'+match[1]).then(data=>{
   if(epoch===accessEpoch.current&&version===detailVersion.current){setPlant(data.plant);setActivities(data.activities);}
  }).catch(e=>{if(epoch===accessEpoch.current&&version===detailVersion.current)setError(e instanceof ApiError?e.message:'Die Pflanze konnte nicht geladen werden.');});
 },[boot?.authenticated]);
 useEffect(()=>{const reconnect=()=>{void refresh();};window.addEventListener('online',reconnect);return()=>window.removeEventListener('online',reconnect);},[]);
 useEffect(()=>{
  const denied=()=>{loadVersion.current++;accessEpoch.current++;resetCollection();setBoot(current=>current?{...current,authenticated:false}:current);setLoading(false);setTab('today');history.replaceState({},'','/login');};
  window.addEventListener('kratzbaum:access-denied',denied);
  return()=>window.removeEventListener('kratzbaum:access-denied',denied);
 },[]);
 const roomEpoch=accessEpoch.current;
 const applyRoomChange=(change:RoomChange)=>{
  if(roomEpoch!==accessEpoch.current)return;
  // An older collection read must not replace a confirmed room mutation.
  loadVersion.current++;setLoading(false);setRoomsUnavailable(false);
  if(change.type==='saved'){
   setRooms(current=>[...current.filter(room=>room.id!==change.room.id),change.room].sort((a,b)=>a.name.localeCompare(b.name)));
   return;
  }
  const unassign=<T extends {room_id?:string|null}>(item:T):T=>item.room_id===change.id?{...item,room_id:null}:item;
  setRooms(current=>current.filter(room=>room.id!==change.id));
  setSelectedRoom(current=>current===change.id?'all':current);
  setPlants(current=>current.map(unassign));
  setPlant(current=>current?unassign(current):null);
  setEditing(current=>current?unassign(current):null);
  setToday(current=>current?{...current,due:current.due.map(unassign),next:current.next.map(unassign),not_started:current.not_started.map(unassign)}:current);
 };
 const applyPlantRoom=(saved:Plant)=>{
  if(roomEpoch!==accessEpoch.current)return;
  loadVersion.current++;setLoading(false);
  const assign=<T extends {room_id?:string|null}>(item:T):T=>({...item,room_id:saved.room_id??null});
  setPlants(current=>current.map(item=>item.id===saved.id?assign(item):item));
  setToday(current=>current?{...current,due:current.due.map(item=>item.plant_id===saved.id?assign(item):item),next:current.next.map(item=>item.plant_id===saved.id?assign(item):item),not_started:current.not_started.map(item=>item.plant_id===saved.id?assign(item):item)}:current);
  if(location.pathname==='/plants/'+saved.id){detailVersion.current++;setPlant(current=>current?.id===saved.id?assign(current):current);}
 };
 const openPlant=async(p:Plant)=>{
  const epoch=accessEpoch.current, version=++detailVersion.current;
  setPlant(p);setActivityFilter('all');setTab('plants');history.pushState({},'','/plants/'+p.id);
  try{const data=await get<{plant:Plant;activities:Activity[]}>('/api/plants/'+p.id);if(epoch===accessEpoch.current&&version===detailVersion.current){setPlant(data.plant);setActivities(data.activities);}}
  catch(e){if(epoch===accessEpoch.current&&version===detailVersion.current)setError(e instanceof ApiError?e.message:'Die Pflanze konnte nicht geladen werden.');}
 };
 const nav=(destination:Tab)=>{detailVersion.current++;setPlant(null);setTab(destination);history.pushState({},'',destination==='today'?'/':'/'+destination);};
 const record=async(p:Plant,type:'watering'|'fertilizing'|'note',note='',occurredAt?:string):Promise<boolean>=>{
  const key=p.id+':'+type;
  if(pendingRecords.current.has(key))return false;
  pendingRecords.current.add(key);
  try {
   await send('/api/plants/'+p.id+'/activities',{type,note,...(type==='note'&&!occurredAt?{}:{occurred_at:occurredAt||new Date().toISOString()})},'POST',{'Idempotency-Key':crypto.randomUUID()});
   await refresh();setRevision(value=>value+1);
   if(plant?.id===p.id)await openPlant(p);
   return true;
  }catch(e){setError(e instanceof ApiError?e.message:'Der Pflegeeintrag konnte nicht gespeichert werden.');return false;}
  finally{pendingRecords.current.delete(key);}
 };
 if(!boot||(boot.auth_mode==='oidc'&&!boot.authenticated))return <LoginPage ready={!!boot} loading={loading} offline={!!boot?.offline} error={error} loginURL={boot?.login_url||'/auth/login'} onRetry={()=>void refresh()}/>;
 const offline=!online||!!boot.offline;
 const roomName=(id?:string|null)=>id?rooms.find(room=>room.id===id)?.name||'Rauminformationen nicht verfügbar':'Nicht zugeordnet';
 const roomPlants=plants.filter(p=>inRoom(p,selectedRoom));
 const search=query.trim().toLowerCase();
 const visiblePlants=roomPlants.filter(p=>[p.name,p.scientific_name,p.common_name].some(value=>value.toLowerCase().includes(search)));
 const due=(today?.due??[]).filter(item=>inRoom(item,selectedRoom));
 const next=(today?.next??[]).filter(item=>inRoom(item,selectedRoom));
 const notStarted=(today?.not_started??[]).filter(item=>inRoom(item,selectedRoom));
 const careRow=(item:DueCare|TodayResponse['not_started'][number],action:boolean)=>{
  const target=plants.find(p=>p.id===item.plant_id);
  return <CareRow key={item.plant_id+item.type} item={item} onOpen={target?()=>{void openPlant(target);}:undefined} disabled={offline||!target} onRecord={action?()=>{if(target)setCareEntry({plant:target,type:item.type});}:undefined}/>;
 };
 return <div className="app-shell">
  <header className="topbar"><a className="brand" href="/" onClick={e=>{e.preventDefault();nav('today');}}><span className="brand-mark">k</span>kratzbaum</a><span className="top-date">{formatInstant(new Date(),boot.timezone,{weekday:'short',month:'short',day:'numeric'})}</span><button className="icon-button" onClick={()=>nav('settings')} aria-label="Einstellungen">⚙</button></header>
  <main className="content">
   <div className="page-heading"><div><p className="eyebrow">{plant?'PFLANZENDETAILS':'DEIN ZIMMERDSCHUNGEL'}</p><h1>{plant?.name??({today:'Heute',plants:'Deine Pflanzen',calendar:'Kalender',rooms:'Räume',settings:'Einstellungen'}[tab])}</h1></div>{tab==='plants'&&!plant&&<button className="primary" disabled={offline} onClick={()=>{setEditing(null);setDialog(true);}}>＋ Pflanze hinzufügen</button>}</div>
   {offline&&<p role="status" className="offline-banner">Offline · nur gespeicherte Daten verfügbar. Zuletzt aktualisiert: {today?.computed_at?formatInstant(today.computed_at,boot.timezone,{dateStyle:'short',timeStyle:'short'}):'nicht verfügbar'}.</p>}
   {error&&<div role="alert" className="alert">{error}<button aria-label="Fehlermeldung schließen" onClick={()=>setError('')}>×</button></div>}
   {loading&&<p role="status" className="muted">Deine Sammlung wird geladen…</p>}
   {(tab==='today'||tab==='plants'&&!plant)&&<RoomFilter rooms={rooms} selected={selectedRoom} onChange={setSelectedRoom} unavailable={roomsUnavailable}/>}
   {roomsUnavailable&&<button className="text-button" disabled={offline} onClick={()=>void refresh()}>Rauminformationen erneut laden</button>}
   {tab==='today'&&<>
    <div className="welcome-card"><div><span className="sun">☀</span><h2>Ein wenig Pflege bewirkt viel.</h2><p>Ein kleiner Schritt für ein grünes Zuhause.</p></div><span className="leaf-art">✿</span></div>
    <section aria-label="Fällige Pflege"><h2 className="section-title">Fällige Pflege <span>{formatNumber(due.length)}</span></h2>{due.length?<div className="care-list">{due.map(item=>careRow(item,true))}</div>:<div className="empty-card"><span>🌱</span><b>Heute ist nichts fällig</b><p>{selectedRoom==='all'?'Genieße deine Pflanzen oder füge eine hinzu.':'In diesem Raum ist keine Pflege fällig.'}</p><button className="text-button" onClick={()=>nav('plants')}>Pflanzen ansehen →</button></div>}</section>
    <section aria-label="Demnächst"><h2 className="section-title">Demnächst <span>{formatNumber(next.length)}</span></h2>{next.length>0&&<div className="care-list">{next.map(item=>careRow(item,false))}</div>}</section>
    <section aria-label="Noch nicht begonnen"><h2 className="section-title">Noch nicht begonnen <span>{formatNumber(notStarted.length)}</span></h2>{notStarted.length>0?<><p className="muted">Trage das erste Gießen oder Düngen ein, um den jeweiligen Pflegeplan zu starten.</p><div className="care-list">{notStarted.map(item=>careRow(item,true))}</div></>:<p className="muted">Keine Pflegepläne warten auf ihren Beginn.</p>}</section>
    <h2 className="section-title">Deine Sammlung <span>{formatNumber(roomPlants.length)}</span><button className="text-button" onClick={()=>nav('plants')}>Alle ansehen →</button></h2><Grid plants={roomPlants.slice(0,4)} open={openPlant} roomName={roomName}/>
   </>}
   {tab==='plants'&&!plant&&<>
    <label className="search">⌕ <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pflanzen oder Arten suchen" aria-label="Pflanzen suchen"/></label>
    {visiblePlants.length?<Grid plants={visiblePlants} open={openPlant} roomName={roomName}/>:plants.length?<div className="empty-card"><b>Keine Pflanzen für diese Auswahl gefunden</b><p>Versuche einen anderen Raum oder Suchbegriff.</p><button className="text-button" onClick={()=>{setQuery('');setSelectedRoom('all');}}>Filter zurücksetzen</button></div>:<div className="empty-card"><span>🪴</span><b>Deine Sammlung wartet auf dich</b><p>Füge eine Pflanze hinzu und behalte ihre Pflege im Blick.</p><button className="primary" disabled={offline} onClick={()=>{setEditing(null);setDialog(true);}}>＋ Erste Pflanze hinzufügen</button></div>}
   </>}
   {tab==='plants'&&plant&&<section><button className="text-button" onClick={()=>{detailVersion.current++;setPlant(null);history.pushState({},'','/plants')}}>← Alle Pflanzen</button><div className="detail-hero"><span>🌿</span><div><h2>{plant.scientific_name.trim()?<WikipediaReference name={plant.scientific_name.trim()} online={!offline}/>:plant.common_name||'Art nicht angegeben'}</h2><p>{plant.family||'Pflanzenfamilie nicht angegeben'}</p></div></div><p className="muted">Raum: {roomName(plant.room_id)}</p><PlantRoom key={plant.id} plant={plant} rooms={rooms} offline={offline} unavailable={roomsUnavailable} disabled={speciesBusy||dialog} onBusyChange={setRoomBusy} onSaveStart={()=>{detailVersion.current++;}} onSaved={applyPlantRoom}/><PlantPhotos key={plant.id} plant={plant} disabled={roomBusy} available={boot.plantnet_available} offline={!online||boot.offline} onBusyChange={setSpeciesBusy} onChanged={()=>{void refresh();void openPlant(plant)}}/><button className="secondary" disabled={speciesBusy||roomBusy||offline} onClick={()=>{setEditing(plant);setDialog(true)}}>Pflanze und Pflegeplan bearbeiten</button><div className="schedule-cards"><div><small>GIESSEN</small><b>{everyDays(plant.watering_interval_days)}</b></div><div><small>DÜNGEN · SOMMER</small><b>{plant.summer_fertilizing_interval_days?everyDays(plant.summer_fertilizing_interval_days):'Nicht angegeben'}</b></div><div><small>DÜNGEN · WINTER</small><b>{plant.winter_fertilizing_interval_days?everyDays(plant.winter_fertilizing_interval_days):'Nicht angegeben'}</b></div></div><div className="quick-actions"><QuickEntry timeZone={boot.timezone} offline={offline} plant={plant} type="watering" record={record}/><QuickEntry timeZone={boot.timezone} offline={offline} plant={plant} type="fertilizing" record={record}/></div><NoteForm offline={offline} save={note=>record(plant,'note',note)}/><h2 className="section-title">Verlauf <span>{formatNumber(activities.length)}</span></h2><div className="activity-filters">{(['all','watering','fertilizing','photo','note'] as const).map(kind=><button key={kind} aria-pressed={activityFilter===kind} onClick={()=>setActivityFilter(kind)}>{kind==='all'?'Alle':activityLabels[kind]}</button>)}</div>{activities.filter(a=>activityFilter==='all'||a.type===activityFilter).map(a=><ActivityRow timeZone={boot.timezone} key={a.id} activity={a} offline={offline} onChanged={()=>{void refresh();void openPlant(plant);setRevision(value=>value+1)}}/>)}</section>}

   {tab==='calendar'&&<Calendar key={revision} plants={plants} month={month||todayISO(boot.timezone).slice(0,7)} timeZone={boot.timezone} change={setMonth}/>}
   {tab==='rooms'&&<div className="rooms-page"><RoomManager rooms={rooms} offline={offline} unavailable={roomsUnavailable} onChanged={applyRoomChange}/></div>}
   {tab==='settings'&&<section className="settings-card"><h2>Sammlungseinstellungen</h2><p>Eine gemeinsame Sammlung für alle mit Zugang zu dieser Installation.</p><dl><dt>Angemeldet</dt><dd>{boot?.display_name||(boot?.authenticated?'Ja':'Nein')}</dd><dt>Anmeldemodus</dt><dd>{boot?.auth_mode==='oidc'?'OpenID Connect':'Freier Zugang'}</dd><dt>Zeitzone</dt><dd>{boot?.timezone??'—'}</dd><dt>Pflanzenbestimmung</dt><dd>{boot?.plantnet_available?'PlantNet eingerichtet':'Art selbst eingeben'}</dd><dt>Pflegetipps</dt><dd>Füge eigene Notizen zu jeder Pflanze hinzu.</dd><dt>Verbindung</dt><dd>{boot?.offline?'Offline · nur gespeicherte Daten':'Online'}</dd><dt>Letzte Pflegeplanberechnung</dt><dd>{today?.computed_at?formatInstant(today.computed_at,boot.timezone,{dateStyle:'short',timeStyle:'short'}):'Offline nicht verfügbar'}</dd></dl>{boot?.auth_mode==='oidc'&&boot.authenticated&&<button className="secondary" onClick={async()=>{localStorage.setItem('kratzbaum-local-logout','1');await finishPendingLogout();await clearLocalCollection();location.assign('/')}}>Abmelden</button>}</section>}
  </main>
  <nav className="bottom-nav" aria-label="Hauptnavigation">{(['today','plants','calendar','rooms'] as const).map(destination=><button key={destination} aria-current={tab===destination?'page':undefined} onClick={()=>nav(destination)}><span aria-hidden="true">{({today:'◷',plants:'♧',calendar:'▦',rooms:'▤'} as const)[destination]}</span>{({today:'Heute',plants:'Pflanzen',calendar:'Kalender',rooms:'Räume'} as const)[destination]}</button>)}</nav>
  {dialog&&<PlantDialog editing={editing} available={boot.plantnet_available} offline={offline} rooms={rooms} roomsUnavailable={roomsUnavailable} onRoomsChanged={applyRoomChange} onClose={()=>{setDialog(false);setEditing(null);}} onSaved={()=>{void (async()=>{await refresh();if(editing)await openPlant(editing);})().catch(e=>setError(e instanceof ApiError?e.message:'Deine Sammlung konnte nicht aktualisiert werden.'));}}/>}
  {careEntry&&<CareEntryDialog timeZone={boot.timezone} plant={careEntry.plant} type={careEntry.type} offline={offline} record={record} onClose={()=>setCareEntry(null)}/>}
 </div>;
}

function Grid({plants,open,roomName}:{plants:Plant[];open:(p:Plant)=>void;roomName:(id?:string|null)=>string}){return <div className="plant-grid">{plants.map(p=><button className="plant-card" key={p.id} onClick={()=>open(p)}><span className="plant-photo">{p.photo_url?<CachedImage src={p.photo_url} alt={p.name}/>:'🌿'}</span><span className="plant-card-text"><b>{p.name}</b><small>{p.scientific_name||p.common_name||'Art hinzufügen'}</small><small className="plant-room">{roomName(p.room_id)}</small><small className="schedule">◒ Gießen: {everyDays(p.watering_interval_days)}</small></span></button>)}</div>}
function QuickEntry({plant,type,record,offline,timeZone}:{offline:boolean;timeZone:string;plant:Plant;type:'watering'|'fertilizing';record:(p:Plant,t:'watering'|'fertilizing'|'note',n?:string,date?:string)=>Promise<boolean>}) {
 const [date,setDate]=useState(()=>dateTimeInput(new Date(),timeZone)),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <div className="quick-entry"><label>{type==='watering'?'Gegossen am':'Gedüngt am'}<input aria-label={type==='watering'?'Datum und Uhrzeit des Gießens':'Datum und Uhrzeit des Düngens'} type="datetime-local" required value={date} onChange={e=>setDate(e.target.value)}/></label><button onClick={async()=>{setBusy(true);setError('');try{if(await record(plant,type,'',inputToInstant(date,timeZone)))setDate(dateTimeInput(new Date(),timeZone));}catch(e){setError(e instanceof InvalidDateTimeError?e.message:'Das Datum konnte nicht gespeichert werden.')}finally{setBusy(false)}}} disabled={busy||offline}>{busy?'Wird gespeichert…':type==='watering'?'◒ Gießen eintragen':'✳ Düngen eintragen'}</button>{error&&<small role="alert">{error}</small>}</div>;
}
function ActivityRow({activity,onChanged,offline,timeZone}:{activity:Activity;onChanged:()=>void;offline:boolean;timeZone:string}) {
 const [editing,setEditing]=useState(false),[date,setDate]=useState(()=>dateTimeInput(activity.occurred_at,timeZone)),[note,setNote]=useState(activity.note||''),[error,setError]=useState('');
 return <article className="timeline-item"><span className={'activity-dot '+activity.type}>{activity.type==='watering'?'◒':activity.type==='fertilizing'?'✳':activity.type==='photo'?'▧':'✎'}</span><div><b>{activityLabels[activity.type]}</b>{!editing&&activity.note&&<p>{activity.note}</p>}{editing?<div className="activity-edit"><label>Datum und Uhrzeit<input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/></label><textarea aria-label="Pflegenotiz bearbeiten" value={note} onChange={e=>setNote(e.target.value)}/><div><button className="text-button" onClick={()=>setEditing(false)}>Abbrechen</button><button className="text-button" disabled={offline} onClick={async()=>{try{await send('/api/activities/'+activity.id,{occurred_at:inputToInstant(date,timeZone),note},'PUT');setEditing(false);onChanged()}catch(e){setError(e instanceof ApiError||e instanceof InvalidDateTimeError?e.message:'Der Eintrag konnte nicht gespeichert werden.')}}}>Speichern</button></div>{error&&<small role="alert">{error}</small>}</div>:<small>{formatInstant(activity.occurred_at,timeZone,{dateStyle:'short',timeStyle:'short'})}{activity.actor_name&&activity.actor_name!=="Shared collection"?` · von ${activity.actor_name}`:""}</small>}</div>{!editing&&<button className="text-button" disabled={offline} onClick={()=>setEditing(true)}>Bearbeiten</button>}<button className="delete-button" aria-label="Eintrag löschen" disabled={offline} onClick={async()=>{try{await send('/api/activities/'+activity.id,undefined,'DELETE');onChanged()}catch(e){setError(e instanceof ApiError?e.message:'Der Eintrag konnte nicht gelöscht werden.')}}}>×</button>{!editing&&error&&<small role="alert">{error}</small>}</article>;
}
function NoteForm({save,offline}:{offline:boolean;save:(note:string)=>Promise<boolean>}) {
 const [value,setValue]=useState('');
 const [busy,setBusy]=useState(false);
 const pending=useRef(false);
 return <><h2 className="section-title">Pflegenotizen</h2><form className="note-form" onSubmit={async event=>{
  event.preventDefault();
  if(pending.current||offline||!value.trim())return;
  pending.current=true;setBusy(true);
  try{if(await save(value))setValue('');}
  finally{pending.current=false;setBusy(false);}
 }}>
  <textarea value={value} onChange={event=>setValue(event.target.value)} disabled={busy||offline} placeholder="Pflegenotiz oder Hinweis hinzufügen…" aria-label="Pflegenotiz"/>
  <button className="primary" disabled={!value.trim()||busy||offline}>{busy?'Notiz wird gespeichert…':'Notiz hinzufügen'}</button>
 </form></>;
}

function Calendar({plants,month,change,timeZone}:{plants:Plant[];month:string;change:(m:string)=>void;timeZone:string}) {
 const [events,setEvents]=useState<Activity[]>([]),[due,setDue]=useState<DueCare[]>([]),[selected,setSelected]=useState(()=>todayISO(timeZone)),[error,setError]=useState('');
 useEffect(()=>{get<{activities:Activity[];due:DueCare[]}>('/api/calendar?month='+month).then(x=>{setEvents(x.activities);setDue(x.due);setError('')}).catch(e=>setError(e instanceof ApiError?e.message:'Kalender nicht verfügbar'))},[month]);
 const first=new Date(month+'-01T12:00:00Z'),start=new Date(first);
 start.setUTCDate(1-(first.getUTCDay()+6)%7);
 const days=Array.from({length:42},(_,i)=>{const d=new Date(start);d.setUTCDate(start.getUTCDate()+i);return d});
 const key=(d:Date)=>d.toISOString().slice(0,10);
 const selectedEvents=events.filter(e=>dateKey(e.occurred_at,timeZone)===selected),selectedDue=due.filter(d=>dateKey(d.due_date,timeZone)===selected);
 const shift=(n:number)=>{const d=new Date(first);d.setUTCMonth(d.getUTCMonth()+n);change(d.toISOString().slice(0,7))};
 return <section className="calendar-card"><div className="calendar-head"><button onClick={()=>shift(-1)} aria-label="Vorheriger Monat">‹</button><h2>{dateOnly(month+'-01',{month:'long',year:'numeric'})}</h2><button onClick={()=>shift(1)} aria-label="Nächster Monat">›</button></div>
  <div className="calendar-grid">{['Mo','Di','Mi','Do','Fr','Sa','So'].map((x,i)=><b key={i}>{x}</b>)}{days.map((d,i)=>{const day=key(d),items=events.filter(e=>dateKey(e.occurred_at,timeZone)===day),scheduled=due.filter(x=>dateKey(x.due_date,timeZone)===day);return <button key={i} onClick={()=>setSelected(day)} aria-pressed={selected===day} className={(d.getUTCMonth()!==first.getUTCMonth()?'outside ':'')+(day===todayISO(timeZone)?'is-today ':'')+(selected===day?'is-selected':'')}>{d.getUTCDate()}{[...items.map(x=>x.type),...scheduled.map(x=>x.type)].slice(0,4).map((type,j)=><i key={j} className={'calendar-mark '+type} title={activityLabels[type]}/>)}</button>})}</div>
  <h3 className="section-title">{dateOnly(selected,{weekday:'long',month:'long',day:'numeric'})}</h3>{error&&<p className="muted">{error}</p>}{selectedDue.map(d=><div className="care-row" key={'due-'+d.plant_id+d.type}><span className={'activity-dot '+d.type}>{d.type==='watering'?'◒':'✳'}</span><div className="care-copy"><b>{d.plant_name}</b><small>{activityLabels[d.type]} · {d.days_overdue>0?overdueDays(d.days_overdue):'heute fällig'}</small></div></div>)}{selectedEvents.length?selectedEvents.map(e=><article className="timeline-item" key={e.id}><span className={'activity-dot '+e.type}>{e.type==='watering'?'◒':e.type==='fertilizing'?'✳':'✎'}</span><div><b>{e.plant_name} · {activityLabels[e.type]}</b>{e.note&&<p>{e.note}</p>}<small>{formatInstant(e.occurred_at,timeZone,{hour:'2-digit',minute:'2-digit'})}</small></div></article>):<p className="muted">Keine abgeschlossene Pflege an diesem Tag.{plants.length===0?' Füge zunächst eine Pflanze hinzu.':''}</p>}
 </section>;
}


createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
let update: ((reloadPage?:boolean)=>Promise<void>)|undefined;
update=registerSW({onNeedRefresh(){if(window.confirm('Ein kratzbaum-Update ist bereit. Jetzt neu laden?'))void update?.(true)}});

import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiError, get, send, setRequestContext, clearLocalCollection, finishPendingLogout, activityLabels } from './api';
import type { Activity, Bootstrap, Plant, TodayResponse, DueCare, Room } from './api';
import './styles.css';
import { PlantDialog } from './PlantDialog';
import { PlantDetail } from './PlantDetail';
import { CachedImage } from './PlantPhotos';
import { useOnline } from './Identification';
import { LoginPage } from './LoginPage';
import { CareEntryDialog, CareRow } from './CareOverview';
import { inRoom, RoomFilter, RoomManager } from './Rooms';
import type { RoomChange } from './Rooms';
import { registerSW } from 'virtual:pwa-register';
import { dateKey, dateOnly, everyDays, formatInstant, formatNumber, overdueDays } from './locale';
type PlantList={plants:Plant[]};
type Tab='today'|'plants'|'calendar'|'rooms'|'settings';
const todayISO=(timeZone:string)=>dateKey(new Date(),timeZone);
function App() {
 const online = useOnline();
 const [speciesBusy,setSpeciesBusy] = useState(false);
 const [careUnavailable,setCareUnavailable] = useState(false);
 const [notice,setNotice] = useState('');
 const [editGroup,setEditGroup] = useState<'details'|'care'|'notes'>('details');
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
 const [detailLoading,setDetailLoading] = useState(false);
 const [detailFailed,setDetailFailed] = useState(false);
 const [month,setMonth] = useState(new URLSearchParams(location.search).get('month')||'');
 const careLauncher = useRef<HTMLElement | null>(null);
 const editLauncher = useRef<HTMLElement | null>(null);
 const pendingRecords = useRef(new Set<string>());
 const loadVersion = useRef(0);
 const detailVersion = useRef(0);
 const accessEpoch = useRef(0);
 const identity = useRef('');
 const resetCollection = () => {
  detailVersion.current++;setNotice('');
  setPlants([]);setToday(null);setRooms([]);setRoomsUnavailable(true);setSelectedRoom('all');
  setPlant(null);setActivities([]);setDetailLoading(false);setDetailFailed(false);setDialog(false);setEditing(null);setCareEntry(null);setQuery('');setSpeciesBusy(false);
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
   setCareUnavailable(todayRead.status==='rejected');
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
  setDetailLoading(true);setDetailFailed(false);
  get<{plant:Plant;activities:Activity[]}>('/api/plants/'+match[1]).then(data=>{
   if(epoch===accessEpoch.current&&version===detailVersion.current){setPlant(data.plant);setActivities(data.activities);setDetailLoading(false);setDetailFailed(false);}
  }).catch(e=>{if(epoch===accessEpoch.current&&version===detailVersion.current){setDetailLoading(false);setDetailFailed(true);setError(e instanceof ApiError?e.message:'Die Pflanze konnte nicht geladen werden.');}});
 },[boot?.authenticated]);
 useEffect(()=>{const reconnect=()=>{void refresh();};window.addEventListener('online',reconnect);return()=>window.removeEventListener('online',reconnect);},[]);
 useEffect(()=>{
  const denied=()=>{loadVersion.current++;accessEpoch.current++;resetCollection();setBoot(current=>current?{...current,authenticated:false}:current);setLoading(false);setTab('today');history.replaceState({},'','/login');};
  window.addEventListener('kratzbaum:access-denied',denied);
  return()=>window.removeEventListener('kratzbaum:access-denied',denied);
 },[]);
 useEffect(()=>{
  const onPop=()=>{
   detailVersion.current++;setDialog(false);setEditing(null);setCareEntry(null);setNotice('');
   const match=location.pathname.match(/^\/plants\/([a-f0-9-]{36})$/);
   if(match&&boot?.authenticated){
    setTab('plants');setPlant(null);setActivities([]);setDetailLoading(true);setDetailFailed(false);
    const version=detailVersion.current,epoch=accessEpoch.current;
    get<{plant:Plant;activities:Activity[]}>('/api/plants/'+match[1]).then(data=>{if(version===detailVersion.current&&epoch===accessEpoch.current){setPlant(data.plant);setActivities(data.activities);setDetailLoading(false);setDetailFailed(false);}}).catch(e=>{if(version===detailVersion.current&&epoch===accessEpoch.current){setDetailLoading(false);setDetailFailed(true);setError(e instanceof ApiError?e.message:'Die Pflanze konnte nicht geladen werden.');}});
   }else{setPlant(null);setTab(location.pathname==='/rooms'?'rooms':location.pathname==='/calendar'?'calendar':location.pathname==='/plants'?'plants':'today');}
  };
  window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);
 },[boot?.authenticated]);
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
 const applyPlantSave=(saved:Plant)=>{
  if(roomEpoch!==accessEpoch.current)return;
  loadVersion.current++;detailVersion.current++;setLoading(false);
  setPlants(current=>current.map(item=>item.id===saved.id?saved:item));
  if(location.pathname==='/plants/'+saved.id)setPlant(saved);
  const assign=<T extends {plant_id:string;room_id?:string|null}>(item:T):T=>item.plant_id===saved.id?{...item,room_id:saved.room_id??null}:item;
  setToday(current=>current?{...current,due:current.due.map(assign),next:current.next.map(assign),not_started:current.not_started.map(assign)}:current);
  setNotice('Pflanze gespeichert.');
 };
 const openPlant=async(p:Plant)=>{
  setDetailLoading(true);setDetailFailed(false);
  const epoch=accessEpoch.current, version=++detailVersion.current;
  if(location.pathname!=='/plants/'+p.id){setActivities([]);setNotice('');}
  setPlant(p);setTab('plants');if(location.pathname!=='/plants/'+p.id)history.pushState({},'','/plants/'+p.id);
  try{const data=await get<{plant:Plant;activities:Activity[]}>('/api/plants/'+p.id);if(epoch===accessEpoch.current&&version===detailVersion.current){setPlant(data.plant);setActivities(data.activities);setDetailLoading(false);setDetailFailed(false);}}
  catch(e){if(epoch===accessEpoch.current&&version===detailVersion.current){setDetailLoading(false);setDetailFailed(true);setError(e instanceof ApiError?e.message:'Die Pflanze konnte nicht geladen werden.');}}
 };
 const nav=(destination:Tab)=>{detailVersion.current++;setDialog(false);setEditing(null);setCareEntry(null);setNotice('');setPlant(null);setTab(destination);history.pushState({},'',destination==='today'?'/':'/'+destination);};
 const record=async(p:Plant,type:'watering'|'fertilizing'|'note',note='',occurredAt?:string):Promise<boolean>=>{
  const key=p.id+':'+type;
  if(pendingRecords.current.has(key))return false;
  pendingRecords.current.add(key);
  try {
   try {
    await send('/api/plants/'+p.id+'/activities',{type,note,...(type==='note'&&!occurredAt?{}:{occurred_at:occurredAt||new Date().toISOString()})},'POST',{'Idempotency-Key':crypto.randomUUID()});
   } catch(e) {setError(e instanceof ApiError?e.message:'Der Pflegeeintrag konnte nicht gespeichert werden.');return false;}
   setNotice(type==='watering'?'Gießen gespeichert.':type==='fertilizing'?'Düngen gespeichert.':'Notiz gespeichert.');
   setRevision(value=>value+1);setCareUnavailable(true);
   // The write is confirmed. Failed follow-up reads must never invite resubmission.
   await refresh();
   if(location.pathname==='/plants/'+p.id)await openPlant(p);
   return true;
  }
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
  return <CareRow key={item.plant_id+item.type} item={item} onOpen={target?()=>{void openPlant(target);}:undefined} disabled={offline||!target} onRecord={action?()=>{if(target){careLauncher.current=document.activeElement as HTMLElement;setCareEntry({plant:target,type:item.type});}}:undefined}/>;
 };
 return <div className={'app-shell' + (plant ? ' has-plant' : '')}>
  <header className="topbar"><a className="brand" href="/" onClick={e=>{e.preventDefault();nav('today');}}><span className="brand-mark">k</span>kratzbaum</a><span className="top-date">{formatInstant(new Date(),boot.timezone,{weekday:'short',month:'short',day:'numeric'})}</span><button className="icon-button" onClick={()=>nav('settings')} aria-label="Einstellungen">⚙</button></header>
  <main className="content">
   {!plant&&<div className="page-heading"><div><p className="eyebrow">DEIN ZIMMERDSCHUNGEL</p><h1>{({today:'Heute',plants:'Deine Pflanzen',calendar:'Kalender',rooms:'Räume',settings:'Einstellungen'}[tab])}</h1></div>{tab==='plants'&&!plant&&<button className="primary" disabled={offline} onClick={()=>{setEditing(null);setDialog(true);}}>＋ Pflanze hinzufügen</button>}</div>}
   {offline&&<p role="status" className="offline-banner">Offline · nur gespeicherte Daten verfügbar. Zuletzt aktualisiert: {today?.computed_at?formatInstant(today.computed_at,boot.timezone,{dateStyle:'short',timeStyle:'short'}):'nicht verfügbar'}.</p>}
   {error&&<div role="alert" className="alert">{error}<button aria-label="Fehlermeldung schließen" onClick={()=>setError('')}>×</button></div>}
   {notice&&<p className="save-notice" role="status">✓ {notice}</p>}
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
   {tab==='plants'&&plant&&<PlantDetail key={plant.id} plant={plant} activities={activities} activitiesLoading={detailLoading} activitiesError={detailFailed} today={today} careUnavailable={careUnavailable} rooms={rooms} offline={offline} timeZone={boot.timezone} available={boot.plantnet_available} busy={speciesBusy||dialog||!!careEntry} onSpeciesBusy={setSpeciesBusy} onEdit={group=>{editLauncher.current=document.activeElement as HTMLElement;setEditing(plant);setEditGroup(group);setDialog(true);}} onCare={type=>{careLauncher.current=document.activeElement as HTMLElement;setCareEntry({plant,type});}} onBack={()=>{detailVersion.current++;setPlant(null);setNotice('');history.pushState({},'','/plants');}} onChanged={()=>{void refresh();void openPlant(plant);setRevision(value=>value+1);}} record={record}/>}

   {tab==='calendar'&&<Calendar key={revision} plants={plants} month={month||todayISO(boot.timezone).slice(0,7)} timeZone={boot.timezone} change={setMonth}/>}
   {tab==='rooms'&&<div className="rooms-page"><RoomManager rooms={rooms} offline={offline} unavailable={roomsUnavailable} onChanged={applyRoomChange}/></div>}
   {tab==='settings'&&<section className="settings-card"><h2>Einstellungen der Sammlung</h2><p>Eine gemeinsame Sammlung für alle mit Zugang zu dieser Installation.</p><dl><dt>Angemeldet</dt><dd>{boot?.display_name||(boot?.authenticated?'Ja':'Nein')}</dd><dt>Anmeldemodus</dt><dd>{boot?.auth_mode==='oidc'?'OpenID Connect':'Freier Zugang'}</dd><dt>Zeitzone</dt><dd>{boot?.timezone??'—'}</dd><dt>Pflanzenbestimmung</dt><dd>{boot?.plantnet_available?'PlantNet eingerichtet':'Art selbst eingeben'}</dd><dt>Pflegetipps</dt><dd>Füge eigene Notizen zu jeder Pflanze hinzu.</dd><dt>Verbindung</dt><dd>{boot?.offline?'Offline · nur gespeicherte Daten':'Online'}</dd><dt>Letzte Pflegeplanberechnung</dt><dd>{today?.computed_at?formatInstant(today.computed_at,boot.timezone,{dateStyle:'short',timeStyle:'short'}):'Offline nicht verfügbar'}</dd></dl>{boot?.auth_mode==='oidc'&&boot.authenticated&&<button className="secondary" onClick={async()=>{localStorage.setItem('kratzbaum-local-logout','1');await finishPendingLogout();await clearLocalCollection();location.assign('/')}}>Abmelden</button>}</section>}
  </main>
  <nav className="bottom-nav" aria-label="Hauptnavigation">{(['today','plants','calendar','rooms'] as const).map(destination=><button key={destination} aria-current={tab===destination?'page':undefined} onClick={()=>nav(destination)}><span aria-hidden="true">{({today:'◷',plants:'♧',calendar:'▦',rooms:'▤'} as const)[destination]}</span>{({today:'Heute',plants:'Pflanzen',calendar:'Kalender',rooms:'Räume'} as const)[destination]}</button>)}</nav>
  {dialog&&<PlantDialog returnFocus={editLauncher.current} editing={editing} focusGroup={editGroup} available={boot.plantnet_available} offline={offline} disabled={speciesBusy} rooms={rooms} roomsUnavailable={roomsUnavailable} onRoomsChanged={applyRoomChange} onSaveStart={()=>{detailVersion.current++;}} onClose={()=>{setDialog(false);setEditing(null);}} onSaved={saved=>{if(saved)applyPlantSave(saved);void refresh();if(editing)void openPlant(saved||editing);}}/>}
  {careEntry&&<CareEntryDialog returnFocus={careLauncher.current} timeZone={boot.timezone} plant={careEntry.plant} type={careEntry.type} offline={offline} record={record} onClose={()=>setCareEntry(null)}/>}
 </div>;
}

function Grid({plants,open,roomName}:{plants:Plant[];open:(p:Plant)=>void;roomName:(id?:string|null)=>string}){return <div className="plant-grid">{plants.map(p=><button className="plant-card" key={p.id} onClick={()=>open(p)}><span className="plant-photo">{p.photo_url?<CachedImage src={p.photo_url} alt={p.name}/>:'🌿'}</span><span className="plant-card-text"><b>{p.name}</b><small>{p.scientific_name||p.common_name||'Art hinzufügen'}</small><small className="plant-room">{roomName(p.room_id)}</small><small className="schedule">◒ Gießen: {everyDays(p.watering_interval_days)}</small></span></button>)}</div>}
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

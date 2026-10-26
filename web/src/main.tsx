import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiError, get, send, setRequestContext, clearLocalCollection, finishPendingLogout, activityLabels } from './api';
import type { Activity, ActivityType, Bootstrap, Plant, TodayResponse, DueCare, Room } from './api';
import './styles.css';
import { PlantDialog } from './PlantDialog';
import { CachedImage, PlantPhotos } from './PlantPhotos';
import { useOnline } from './Identification';
import { LoginPage } from './LoginPage';
import { scientificNameWikipediaURL } from './wikipedia';
import { CareEntryDialog, CareRow } from './CareOverview';
import { inRoom, RoomFilter, RoomManager } from './Rooms';
import { registerSW } from 'virtual:pwa-register';
type PlantList={plants:Plant[]};
const todayISO=()=>new Date().toISOString().slice(0,10);
function App() {
 const online = useOnline();
 const [speciesBusy,setSpeciesBusy] = useState(false);
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
 const [tab,setTab] = useState<'today'|'plants'|'calendar'|'settings'>(location.pathname.includes('calendar')?'calendar':location.pathname.includes('plants')?'plants':'today');
 const [plant,setPlant] = useState<Plant|null>(null);
 const [activities,setActivities] = useState<Activity[]>([]);
 const [activityFilter,setActivityFilter] = useState<'all'|ActivityType>('all');
 const [month,setMonth] = useState(new URLSearchParams(location.search).get('month')||todayISO().slice(0,7));
 const pendingRecords = useRef(new Set<string>());
 const loadVersion = useRef(0);
 const accessEpoch = useRef(0);
 const identity = useRef('');
 const resetCollection = () => {
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
     setBoot({...b,authenticated:false,offline:true});setError('Signed out on this device. Connect to finish signing out.');return;
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
   setError(failure?.status==='rejected'?(failure.reason instanceof Error?failure.reason.message:'Unable to load your collection'):'');
  } catch(e) {if(version===loadVersion.current)setError(e instanceof Error?e.message:'Unable to load your collection');}
  finally {if(version===loadVersion.current)setLoading(false);}
 };
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{
  if(!boot?.authenticated)return;
  const match=location.pathname.match(/^\/plants\/([a-f0-9-]{36})$/);
  if(!match)return;
  const epoch=accessEpoch.current;
  get<{plant:Plant;activities:Activity[]}>('/api/plants/'+match[1]).then(data=>{
   if(epoch===accessEpoch.current){setPlant(data.plant);setActivities(data.activities);}
  }).catch(e=>{if(epoch===accessEpoch.current)setError(e instanceof Error?e.message:'Plant could not be loaded');});
 },[boot?.authenticated]);
 useEffect(()=>{const reconnect=()=>{void refresh();};window.addEventListener('online',reconnect);return()=>window.removeEventListener('online',reconnect);},[]);
 useEffect(()=>{
  const denied=()=>{loadVersion.current++;accessEpoch.current++;resetCollection();setBoot(current=>current?{...current,authenticated:false}:current);setLoading(false);setTab('today');history.replaceState({},'','/login');};
  window.addEventListener('kratzbaum:access-denied',denied);
  return()=>window.removeEventListener('kratzbaum:access-denied',denied);
 },[]);
 const openPlant=async(p:Plant)=>{
  const epoch=accessEpoch.current;
  setPlant(p);setActivityFilter('all');setTab('plants');history.pushState({},'','/plants/'+p.id);
  try{const data=await get<{plant:Plant;activities:Activity[]}>('/api/plants/'+p.id);if(epoch===accessEpoch.current){setPlant(data.plant);setActivities(data.activities);}}
  catch(e){if(epoch===accessEpoch.current)setError(String(e));}
 };
 const nav=(destination:'today'|'plants'|'calendar'|'settings')=>{setPlant(null);setTab(destination);history.pushState({},'',destination==='today'?'/':'/'+destination);};
 const record=async(p:Plant,type:'watering'|'fertilizing'|'note',note='',occurredAt?:string):Promise<boolean>=>{
  const key=p.id+':'+type;
  if(pendingRecords.current.has(key))return false;
  pendingRecords.current.add(key);
  try {
   await send('/api/plants/'+p.id+'/activities',{type,occurred_at:occurredAt||new Date().toISOString(),note},'POST',{'Idempotency-Key':crypto.randomUUID()});
   await refresh();setRevision(value=>value+1);
   if(plant?.id===p.id)await openPlant(p);
   return true;
  }catch(e){setError(e instanceof Error?e.message:'Unable to save activity');return false;}
  finally{pendingRecords.current.delete(key);}
 };
 if(!boot||(boot.auth_mode==='oidc'&&!boot.authenticated))return <LoginPage ready={!!boot} loading={loading} offline={!!boot?.offline} error={error} loginURL={boot?.login_url||'/auth/login'} onRetry={()=>void refresh()}/>;
 const offline=!online||!!boot.offline;
 const speciesURL=plant?scientificNameWikipediaURL(plant.scientific_name):null;
 const roomName=(id?:string|null)=>id?rooms.find(room=>room.id===id)?.name||'Room information unavailable':'Unassigned';
 const roomPlants=plants.filter(p=>inRoom(p,selectedRoom));
 const search=query.trim().toLowerCase();
 const visiblePlants=roomPlants.filter(p=>[p.name,p.scientific_name,p.common_name].some(value=>value.toLowerCase().includes(search)));
 const due=(today?.due??[]).filter(item=>inRoom(item,selectedRoom));
 const next=(today?.next??[]).filter(item=>inRoom(item,selectedRoom));
 const notStarted=(today?.not_started??[]).filter(item=>inRoom(item,selectedRoom));
 const careRow=(item:DueCare|TodayResponse['not_started'][number],action:boolean)=>{
  const target=plants.find(p=>p.id===item.plant_id);
  return <CareRow key={item.plant_id+item.type} item={item} disabled={offline||!target} onRecord={action?()=>{if(target)setCareEntry({plant:target,type:item.type});}:undefined}/>;
 };
 return <div className="app-shell">
  <header className="topbar"><a className="brand" href="/" onClick={e=>{e.preventDefault();nav('today');}}><span className="brand-mark">k</span>kratzbaum</a><span className="top-date">{new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date())}</span><button className="icon-button" onClick={()=>nav('settings')} aria-label="Settings">⚙</button></header>
  <main className="content">
   <div className="page-heading"><div><p className="eyebrow">{plant?'PLANT DETAILS':'YOUR INDOOR JUNGLE'}</p><h1>{plant?.name??({today:'Today',plants:'Your plants',calendar:'Calendar',settings:'Settings'}[tab])}</h1></div>{tab==='plants'&&!plant&&<button className="primary" disabled={offline} onClick={()=>{setEditing(null);setDialog(true);}}>＋ Add plant</button>}</div>
   {offline&&<p role="status" className="offline-banner">Offline · saved reads only. Last refreshed: {today?.computed_at?new Date(today.computed_at).toLocaleString():'unavailable'}.</p>}
   {error&&<div role="alert" className="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError('')}>×</button></div>}
   {loading&&<p role="status" className="muted">Loading your collection…</p>}
   {(tab==='today'||tab==='plants'&&!plant)&&<RoomFilter rooms={rooms} selected={selectedRoom} onChange={setSelectedRoom} unavailable={roomsUnavailable}/>}
   {roomsUnavailable&&<button className="text-button" disabled={offline} onClick={()=>void refresh()}>Retry room information</button>}
   {tab==='today'&&<>
    <div className="welcome-card"><div><span className="sun">☀</span><h2>A little care goes a long way.</h2><p>Your next small step for a thriving home.</p></div><span className="leaf-art">✿</span></div>
    <section aria-label="Care due"><h2 className="section-title">Care due <span>{due.length}</span></h2>{due.length?<div className="care-list">{due.map(item=>careRow(item,true))}</div>:<div className="empty-card"><span>🌱</span><b>Nothing due today</b><p>{selectedRoom==='all'?'Enjoy your plants, or add one to get started.':'No care is due in this room.'}</p><button className="text-button" onClick={()=>nav('plants')}>View plants →</button></div>}</section>
    <section aria-label="Upcoming"><h2 className="section-title">Upcoming <span>{next.length}</span></h2>{next.length>0&&<div className="care-list">{next.map(item=>careRow(item,false))}</div>}</section>
    <section aria-label="Not started yet"><h2 className="section-title">Not started yet <span>{notStarted.length}</span></h2>{notStarted.length>0?<><p className="muted">Record the first time you water or fertilize to start each schedule.</p><div className="care-list">{notStarted.map(item=>careRow(item,true))}</div></>:<p className="muted">No care schedules waiting to start.</p>}</section>
    <h2 className="section-title">Your collection <span>{roomPlants.length}</span><button className="text-button" onClick={()=>nav('plants')}>See all →</button></h2><Grid plants={roomPlants.slice(0,4)} open={openPlant} roomName={roomName}/>
   </>}
   {tab==='plants'&&!plant&&<>
    <label className="search">⌕ <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search plants or species" aria-label="Search plants"/></label>
    {visiblePlants.length?<Grid plants={visiblePlants} open={openPlant} roomName={roomName}/>:plants.length?<div className="empty-card"><b>No plants match this selection</b><p>Try another room or search.</p><button className="text-button" onClick={()=>{setQuery('');setSelectedRoom('all');}}>Clear filters</button></div>:<div className="empty-card"><span>🪴</span><b>Your collection is waiting</b><p>Add a plant and keep its care in one place.</p><button className="primary" disabled={offline} onClick={()=>{setEditing(null);setDialog(true);}}>＋ Add your first plant</button></div>}
   </>}
   {tab==='plants'&&plant&&<section><button className="text-button" onClick={()=>{setPlant(null);history.pushState({},'','/plants')}}>← All plants</button><div className="detail-hero"><span>🌿</span><div><h2>{speciesURL?<a className="species-reference" href={speciesURL} target="_blank" rel="noopener noreferrer" aria-label={`${plant.scientific_name.trim()} on Wikipedia (opens in a new tab)`}>{plant.scientific_name.trim()} <span aria-hidden="true">↗</span></a>:plant.common_name||'Species not set'}</h2><p>{plant.family||'Plant family not set'}</p></div></div><p className="muted">Room: {roomName(plant.room_id)}</p><PlantPhotos key={plant.id} plant={plant} available={boot.plantnet_available} offline={!online||boot.offline} onBusyChange={setSpeciesBusy} onChanged={()=>{void refresh();void openPlant(plant)}}/><button className="secondary" disabled={speciesBusy||offline} onClick={()=>{setEditing(plant);setDialog(true)}}>Edit plant and care schedule</button><div className="schedule-cards"><div><small>WATERING</small><b>Every {plant.watering_interval_days} days</b></div><div><small>FERTILIZE · SUMMER</small><b>{plant.summer_fertilizing_interval_days?`Every ${plant.summer_fertilizing_interval_days} days`:'Not set'}</b></div><div><small>FERTILIZE · WINTER</small><b>{plant.winter_fertilizing_interval_days?`Every ${plant.winter_fertilizing_interval_days} days`:'Not set'}</b></div></div><div className="quick-actions"><QuickEntry offline={offline} plant={plant} type="watering" record={record}/><QuickEntry offline={offline} plant={plant} type="fertilizing" record={record}/></div><NoteForm offline={offline} save={(n,date)=>record(plant,'note',n,new Date(date).toISOString())}/><h2 className="section-title">Timeline <span>{activities.length}</span></h2><div className="activity-filters">{(['all','watering','fertilizing','photo','note'] as const).map(kind=><button key={kind} aria-pressed={activityFilter===kind} onClick={()=>setActivityFilter(kind)}>{kind==='all'?'All':activityLabels[kind]}</button>)}</div>{activities.filter(a=>activityFilter==='all'||a.type===activityFilter).map(a=><ActivityRow key={a.id} activity={a} offline={offline} onChanged={()=>{void refresh();void openPlant(plant);setRevision(value=>value+1)}}/>)}</section>}

   {tab==='calendar'&&<Calendar key={revision} plants={plants} month={month} change={setMonth}/>}
   {tab==='settings'&&<><section className="settings-card"><h2>Collection settings</h2><p>One shared collection for everyone with access to this deployment.</p><dl><dt>Signed in</dt><dd>{boot?.display_name||(boot?.authenticated?'Yes':'No')}</dd><dt>Sign-in mode</dt><dd>{boot?.auth_mode==='oidc'?'OpenID Connect':'Open access'}</dd><dt>Timezone</dt><dd>{boot?.timezone??'—'}</dd><dt>Species identification</dt><dd>{boot?.plantnet_available?'PlantNet configured':'Enter species manually'}</dd><dt>Care advice</dt><dd>Add your own notes on each plant.</dd><dt>Connection</dt><dd>{boot?.offline?'Offline · saved reads only':'Online'}</dd><dt>Last schedule calculation</dt><dd>{today?.computed_at?new Date(today.computed_at).toLocaleString():'Not available offline'}</dd></dl>{boot?.auth_mode==='oidc'&&boot.authenticated&&<button className="secondary" onClick={async()=>{localStorage.setItem('kratzbaum-local-logout','1');await finishPendingLogout();await clearLocalCollection();location.assign('/')}}>Sign out</button>}</section><RoomManager rooms={rooms} offline={offline} unavailable={roomsUnavailable} onChanged={refresh}/></>}
  </main>
  <nav className="bottom-nav" aria-label="Main navigation">{(['today','plants','calendar'] as const).map(destination=><button key={destination} aria-current={tab===destination?'page':undefined} onClick={()=>nav(destination)}><span>{({today:'◷',plants:'♧',calendar:'▦'} as const)[destination]}</span>{destination[0].toUpperCase()+destination.slice(1)}</button>)}</nav>
  {dialog&&<PlantDialog editing={editing} available={boot.plantnet_available} offline={offline} rooms={rooms} roomsUnavailable={roomsUnavailable} onRoomsChanged={refresh} onClose={()=>{setDialog(false);setEditing(null);}} onSaved={()=>{void (async()=>{await refresh();if(editing)await openPlant(editing);})().catch(e=>setError(e instanceof Error?e.message:'Unable to refresh your collection'));}}/>}
  {careEntry&&<CareEntryDialog plant={careEntry.plant} type={careEntry.type} offline={offline} record={record} onClose={()=>setCareEntry(null)}/>}
 </div>;
}

function Grid({plants,open,roomName}:{plants:Plant[];open:(p:Plant)=>void;roomName:(id?:string|null)=>string}){return <div className="plant-grid">{plants.map(p=><button className="plant-card" key={p.id} onClick={()=>open(p)}><span className="plant-photo">{p.photo_url?<CachedImage src={p.photo_url} alt={p.name}/>:'🌿'}</span><span className="plant-card-text"><b>{p.name}</b><small>{p.scientific_name||p.common_name||'Add species information'}</small><small className="plant-room">{roomName(p.room_id)}</small><small className="schedule">◒ Water every {p.watering_interval_days} days</small></span></button>)}</div>}
function localDateTime(value?:string){const d=value?new Date(value):new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function QuickEntry({plant,type,record,offline}:{offline:boolean;plant:Plant;type:'watering'|'fertilizing';record:(p:Plant,t:'watering'|'fertilizing'|'note',n?:string,date?:string)=>Promise<boolean>}){const [date,setDate]=useState(localDateTime()),[busy,setBusy]=useState(false);return <div className="quick-entry"><label>{type==='watering'?'Watered at':'Fertilized at'}<input aria-label={type==='watering'?'Watering date and time':'Fertilizing date and time'} type="datetime-local" required value={date} onChange={e=>setDate(e.target.value)}/></label><button onClick={async()=>{setBusy(true);if(await record(plant,type,'',new Date(date).toISOString()))setDate(localDateTime());setBusy(false)}} disabled={busy||offline}>{busy?'Saving…':type==='watering'?'◒ Record watering':'✳ Record fertilizing'}</button></div>}
function ActivityRow({activity,onChanged,offline}:{activity:Activity;onChanged:()=>void;offline:boolean}){const [editing,setEditing]=useState(false),[date,setDate]=useState(localDateTime(activity.occurred_at)),[note,setNote]=useState(activity.note||''),[error,setError]=useState('');return <article className="timeline-item"><span className={'activity-dot '+activity.type}>{activity.type==='watering'?'◒':activity.type==='fertilizing'?'✳':activity.type==='photo'?'▧':'✎'}</span><div><b>{activityLabels[activity.type]}</b>{!editing&&activity.note&&<p>{activity.note}</p>}{editing?<div className="activity-edit"><label>Date and time<input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/></label><textarea aria-label="Edit activity note" value={note} onChange={e=>setNote(e.target.value)}/><div><button className="text-button" onClick={()=>setEditing(false)}>Cancel</button><button className="text-button" disabled={offline} onClick={async()=>{try{await send('/api/activities/'+activity.id,{occurred_at:new Date(date).toISOString(),note},'PUT');setEditing(false);onChanged()}catch(e){setError(String(e))}}}>Save</button></div>{error&&<small role="alert">{error}</small>}</div>:<small>{new Date(activity.occurred_at).toLocaleString()}{activity.actor_name&&activity.actor_name!=="Shared collection"?` · by ${activity.actor_name}`:""}</small>}</div>{!editing&&<button className="text-button" disabled={offline} onClick={()=>setEditing(true)}>Edit</button>}<button className="delete-button" aria-label="Delete activity" disabled={offline} onClick={async()=>{await send('/api/activities/'+activity.id,undefined,'DELETE');onChanged()}}>×</button></article>}
function NoteForm({save,offline}:{offline:boolean;save:(n:string,date:string)=>Promise<boolean>}){const [value,set]=useState(''),[date,setDate]=useState(localDateTime()),[busy,busySet]=useState(false);return <><h2 className="section-title">Care notes</h2><div className="note-form"><textarea value={value} onChange={e=>set(e.target.value)} placeholder="Add a care note or advice…" aria-label="Care note"/><label>Written at<input aria-label="Care note date and time" type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/></label><button className="primary" disabled={!value.trim()||busy||offline} onClick={async()=>{busySet(true);if(await save(value,date)){set('');setDate(localDateTime())}busySet(false)}}>Add note</button></div></>}
function Calendar({plants,month,change}:{plants:Plant[];month:string;change:(m:string)=>void}){const [events,setEvents]=useState<Activity[]>([]),[due,setDue]=useState<DueCare[]>([]),[selected,setSelected]=useState(todayISO()),[error,setError]=useState('');useEffect(()=>{get<{activities:Activity[];due:DueCare[]}>('/api/calendar?month='+month).then(x=>{setEvents(x.activities);setDue(x.due);setError('')}).catch(e=>setError(e instanceof Error?e.message:'Calendar unavailable'))},[month]);const first=new Date(month+'-01T12:00:00'),start=new Date(first);start.setDate(1-first.getDay());const days=Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d});const key=(d:Date)=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');const selectedEvents=events.filter(e=>key(new Date(e.occurred_at))===selected),selectedDue=due.filter(d=>key(new Date(d.due_date))===selected);const shift=(n:number)=>{const d=new Date(first);d.setMonth(d.getMonth()+n);change(d.toISOString().slice(0,7))};return <section className="calendar-card"><div className="calendar-head"><button onClick={()=>shift(-1)} aria-label="Previous month">‹</button><h2>{first.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h2><button onClick={()=>shift(1)} aria-label="Next month">›</button></div><div className="calendar-grid">{['S','M','T','W','T','F','S'].map((x,i)=><b key={i}>{x}</b>)}{days.map((d,i)=>{const day=key(d),items=events.filter(e=>key(new Date(e.occurred_at))===day),scheduled=due.filter(x=>key(new Date(x.due_date))===day);return <button key={i} onClick={()=>setSelected(day)} aria-pressed={selected===day} className={(d.getMonth()!==first.getMonth()?'outside ':'')+(day===todayISO()?'is-today ':'')+(selected===day?'is-selected':'')}>{d.getDate()}{[...items.map(x=>x.type),...scheduled.map(x=>x.type)].slice(0,4).map((type,j)=><i key={j} className={'calendar-mark '+type} title={activityLabels[type]}/>)}</button>})}</div><h3 className="section-title">{new Date(selected+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</h3>{error&&<p className="muted">{error}</p>}{selectedDue.map(d=><div className="care-row" key={'due-'+d.plant_id+d.type}><span className={'activity-dot '+d.type}>{d.type==='watering'?'◒':'✳'}</span><div className="care-copy"><b>{d.plant_name}</b><small>{activityLabels[d.type]} · {d.days_overdue>0?d.days_overdue+' days overdue':'due today'}</small></div></div>)}{selectedEvents.length?selectedEvents.map(e=><article className="timeline-item" key={e.id}><span className={'activity-dot '+e.type}>{e.type==='watering'?'◒':e.type==='fertilizing'?'✳':'✎'}</span><div><b>{e.plant_name} · {activityLabels[e.type]}</b>{e.note&&<p>{e.note}</p>}<small>{new Date(e.occurred_at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</small></div></article>):<p className="muted">No completed activity on this day.{plants.length===0?' Add a plant to begin.':''}</p>}</section>}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
let update: ((reloadPage?:boolean)=>Promise<void>)|undefined;
update=registerSW({onNeedRefresh(){if(window.confirm('A new kratzbaum update is ready. Reload now?'))void update?.(true)}});

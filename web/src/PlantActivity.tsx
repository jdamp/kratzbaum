import { useRef, useState } from 'react';
import { ApiError, send, activityLabels } from './api';
import type { Activity } from './api';
import { dateTimeInput, formatInstant, inputToInstant, InvalidDateTimeError } from './locale';

export function ActivityRow({activity,onChanged,offline,timeZone}:{activity:Activity;onChanged:()=>void;offline:boolean;timeZone:string}) {
 const [editing,setEditing]=useState(false),[date,setDate]=useState(()=>dateTimeInput(activity.occurred_at,timeZone)),[note,setNote]=useState(activity.note||''),[error,setError]=useState('');
 return <article className="timeline-item"><span className={'activity-dot '+activity.type}>{activity.type==='watering'?'◒':activity.type==='fertilizing'?'✳':activity.type==='photo'?'▧':'✎'}</span><div><b>{activityLabels[activity.type]}</b>{!editing&&activity.note&&<p>{activity.note}</p>}{editing?<div className="activity-edit"><label>Datum und Uhrzeit<input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/></label><textarea aria-label="Pflegenotiz bearbeiten" value={note} onChange={e=>setNote(e.target.value)}/><div><button className="text-button" onClick={()=>setEditing(false)}>Abbrechen</button><button className="text-button" disabled={offline} onClick={async()=>{try{await send('/api/activities/'+activity.id,{occurred_at:inputToInstant(date,timeZone),note},'PUT');setEditing(false);onChanged()}catch(e){setError(e instanceof ApiError||e instanceof InvalidDateTimeError?e.message:'Der Eintrag konnte nicht gespeichert werden.')}}}>Speichern</button></div>{error&&<small role="alert">{error}</small>}</div>:<small>{formatInstant(activity.occurred_at,timeZone,{dateStyle:'short',timeStyle:'short'})}{activity.actor_name&&activity.actor_name!=="Shared collection"?` · von ${activity.actor_name}`:""}</small>}</div>{!editing&&<button className="text-button" disabled={offline} onClick={()=>setEditing(true)}>Bearbeiten</button>}<button className="delete-button" aria-label="Eintrag löschen" disabled={offline} onClick={async()=>{try{await send('/api/activities/'+activity.id,undefined,'DELETE');onChanged()}catch(e){setError(e instanceof ApiError?e.message:'Der Eintrag konnte nicht gelöscht werden.')}}}>×</button>{!editing&&error&&<small role="alert">{error}</small>}</article>;
}
export function NoteForm({save,offline}:{offline:boolean;save:(note:string)=>Promise<boolean>}) {
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

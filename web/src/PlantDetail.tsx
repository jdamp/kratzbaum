import { useRef, useState } from 'react';
import './plant-detail.css';
import { ArrowLeft, ArrowRight, Camera, Droplets, House, Leaf, NotebookPen, Pencil, Plus } from 'lucide-react';
import type { Activity, ActivityType, Plant, Room, TodayResponse } from './api';
import { activityLabels } from './api';
import type { RecordCare } from './CareOverview';
import { CachedImage, PlantPhotos } from './PlantPhotos';
import { WikipediaReference } from './WikipediaReference';
import { ActivityRow, NoteForm } from './PlantActivity';
import { dateKey, dateOnly, everyDays, formatInstant, formatNumber, overdueDays } from './locale';

type CareType = 'watering' | 'fertilizing';
type Section = 'overview' | 'photos' | 'history';
const sections: Array<{ id: Section; label: string }> = [{ id: 'overview', label: 'Übersicht' }, { id: 'photos', label: 'Fotos' }, { id: 'history', label: 'Verlauf' }];

export function plantCareState(plant: Plant, type: CareType, today: TodayResponse | null, unavailable: boolean, season: 'summer' | 'winter') {
  const interval = type === 'watering' ? plant.watering_interval_days : season === 'summer' ? plant.summer_fertilizing_interval_days : plant.winter_fertilizing_interval_days;
  const paused = type === 'fertilizing' && (season === 'summer' ? plant.summer_fertilizing_paused : plant.winter_fertilizing_paused);
  if (paused) return { label: `Im ${season === 'summer' ? 'Sommer' : 'Winter'} pausiert`, kind: 'paused', interval };
  if (!interval) return { label: 'Nicht angegeben', kind: 'unconfigured', interval };
  if (!today || unavailable) return { label: 'Pflegestatus nicht verfügbar', kind: 'unavailable', interval };
  const due = [...today.due, ...today.next].find(item => item.plant_id === plant.id && item.type === type);
  if (due) return { label: due.days_overdue > 0 ? overdueDays(due.days_overdue) : due.days_until === 0 ? 'Heute fällig' : `Nächstes ${type === 'watering' ? 'Gießen' : 'Düngen'} am ${dateOnly(dateKey(due.due_date, today.timezone), { day: '2-digit', month: '2-digit' })}`, kind: due.days_overdue > 0 ? 'overdue' : due.days_until === 0 ? 'due' : 'upcoming', interval };
  if (today.not_started.some(item => item.plant_id === plant.id && item.type === type)) return { label: 'Noch nicht begonnen', kind: 'not-started', interval };
  return { label: 'Pflegestatus nicht verfügbar', kind: 'unavailable', interval };
}

export function PlantDetail({ plant, activities, activitiesLoading, activitiesError, today, careUnavailable, rooms, offline, timeZone, available, busy, onSpeciesBusy, onEdit, onCare, onBack, onChanged, record }: {
  plant: Plant; activities: Activity[]; activitiesLoading: boolean; activitiesError: boolean; today: TodayResponse | null; careUnavailable: boolean; rooms: Room[]; offline: boolean; timeZone: string; available: boolean; busy: boolean;
  onSpeciesBusy: (busy: boolean) => void; onEdit: (group: 'details' | 'care' | 'notes') => void; onCare: (type: CareType) => void; onBack: () => void; onChanged: () => void; record: RecordCare;
}) {
  const [section, setSection] = useState<Section>('overview');
  const [filter, setFilter] = useState<'all' | ActivityType>('all');
  const [addingNote, setAddingNote] = useState(false);
  const tabList = useRef<HTMLDivElement>(null);
  const noteLauncher = useRef<HTMLButtonElement>(null);
  const room = plant.room_id ? rooms.find(item => item.id === plant.room_id)?.name || 'Rauminformationen nicht verfügbar' : 'Nicht zugeordnet';
  const month = Number(dateKey(new Date(), timeZone).slice(5, 7));
  const season = today && !careUnavailable ? today.season : month >= 4 && month <= 9 ? 'summer' : 'winter';
  const history = () => { setSection('history'); requestAnimationFrame(() => tabList.current?.querySelector<HTMLButtonElement>('#plant-tab-history')?.focus()); };
  return <section className="plant-detail" aria-label="Pflanzendetails">
    <button className="text-button detail-back" onClick={onBack}><ArrowLeft size={18} aria-hidden="true"/> Alle Pflanzen</button>
    <header className="plant-identity">
      <div className="identity-photo">{plant.photo_url ? <><CachedImage src={plant.cover_photo_id ? `/media/${plant.cover_photo_id}/original.jpg` : plant.photo_url} alt={`Foto von ${plant.name}`}/><span className="cover-badge">Titelbild</span></> : <span className="identity-fallback" role="img" aria-label="Kein Titelbild"><Leaf size={48}/></span>}</div>
      <div className="identity-copy"><p className="eyebrow">DEINE PFLANZE</p><h1>{plant.name}</h1>
        <div className="identity-species">{plant.scientific_name.trim() ? <WikipediaReference name={plant.scientific_name.trim()} override={plant.wikipedia_url} online={!offline}/> : <><span>{plant.common_name || 'Art nicht angegeben'}</span>{plant.wikipedia_url && <WikipediaReference name="" override={plant.wikipedia_url} online={!offline}/>}</>}</div>
        <p className="identity-room"><House size={17} aria-hidden="true"/>{room}</p>
        {(plant.common_name || plant.family) && <p className="identity-family">{[plant.common_name, plant.family].filter(Boolean).join(' · ')}</p>}
      </div>
      <button className="secondary identity-edit" disabled={busy || offline} onClick={() => onEdit('details')}><Pencil size={18} aria-hidden="true"/>Bearbeiten</button>
    </header>
    <div ref={tabList} className="plant-tabs" role="tablist" aria-label="Pflanzenbereiche" onKeyDown={event => {
      const index = sections.findIndex(item => item.id === section);
      const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
      if (next < 0) return;
      event.preventDefault(); setSection(sections[next].id); tabList.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus();
    }}>{sections.map(item => <button key={item.id} id={`plant-tab-${item.id}`} role="tab" aria-selected={section === item.id} aria-controls={`plant-panel-${item.id}`} tabIndex={section === item.id ? 0 : -1} onClick={() => setSection(item.id)}>{item.label}</button>)}</div>
    <div id="plant-panel-overview" role="tabpanel" aria-labelledby="plant-tab-overview" hidden={section !== 'overview'}>
      <h2 className="detail-section-title">Pflege im Blick</h2>
      <div className="detail-overview-grid">
        <div className="detail-card care-status-list">{(['watering', 'fertilizing'] as const).map(type => {
          const state = plantCareState(plant, type, today, careUnavailable, season);
          const latest = activitiesLoading || activitiesError ? undefined : activities.find(item => item.type === type);
          const Icon = type === 'watering' ? Droplets : Leaf;
          return <article key={type} className={`detail-care-row ${type}`} aria-label={activityLabels[type]}>
            <span className={`activity-dot ${type}`}><Icon size={22} aria-hidden="true"/></span>
            <div className="detail-care-copy"><h3>{activityLabels[type]}</h3>{(state.interval || latest) && <p>{state.interval ? everyDays(state.interval) : ''}{latest && <>{state.interval ? ' · ' : ''}zuletzt am {formatInstant(latest.occurred_at, timeZone, { day: '2-digit', month: '2-digit' })}</>}</p>}<span className={`care-state ${state.kind}`}>{state.label}</span></div>
            <button className={`care-record ${type}`} disabled={offline || busy} onClick={() => onCare(type)}><Icon size={18} aria-hidden="true"/>{type === 'watering' ? 'Gießen eintragen' : 'Düngen eintragen'}</button>
          </article>;
        })}</div>
        <section className="detail-card care-plan"><div className="card-heading"><h2>Pflegeplan</h2><button className="text-button" disabled={offline || busy} onClick={() => onEdit('care')}>Ändern</button></div><dl>
          <div><dt>Gießen</dt><dd>{everyDays(plant.watering_interval_days)}</dd></div>
          <div><dt>Düngen · Sommer</dt><dd>{plant.summer_fertilizing_paused ? 'Pausiert' : plant.summer_fertilizing_interval_days ? everyDays(plant.summer_fertilizing_interval_days) : 'Nicht angegeben'}</dd></div>
          <div><dt>Düngen · Winter</dt><dd>{plant.winter_fertilizing_paused ? 'Pausiert' : plant.winter_fertilizing_interval_days ? everyDays(plant.winter_fertilizing_interval_days) : 'Nicht angegeben'}</dd></div>
        </dl></section>
        <section className="detail-card detail-recent"><div className="card-heading"><h2>Letzte Aktivitäten</h2><button className="text-button" onClick={history}>Verlauf ansehen <ArrowRight size={16} aria-hidden="true"/></button></div>
          {activitiesLoading ? <p className="muted" role="status">Verlauf wird geladen…</p> : activitiesError ? <p className="muted">Der Verlauf konnte nicht geladen werden.</p> : activities.length ? activities.slice(0, 2).map(activity => <div className="recent-row" key={activity.id}><span className={`activity-dot ${activity.type}`}>{activity.type === 'watering' ? <Droplets size={18}/> : activity.type === 'fertilizing' ? <Leaf size={18}/> : activity.type === 'photo' ? <Camera size={18}/> : <NotebookPen size={18}/>}</span><div><b>{activityLabels[activity.type]}</b>{activity.note && <p>{activity.note}</p>}<small>{formatInstant(activity.occurred_at, timeZone, { dateStyle: 'short', timeStyle: 'short' })}</small></div></div>) : <p className="muted">Noch keine Aktivitäten. Trage die erste Pflege ein oder füge eine Notiz im Verlauf hinzu.</p>}
        </section>
        <section className="detail-card plant-notes"><h2><NotebookPen size={20} aria-hidden="true"/>Pflanzennotizen</h2><p>{plant.notes || 'Hier ist Platz für Hinweise zu Standort und Pflege.'}</p><button className="text-button" disabled={offline || busy} onClick={() => onEdit('notes')}><Pencil size={16} aria-hidden="true"/>{plant.notes ? 'Notizen bearbeiten' : 'Notizen hinzufügen'}</button></section>
      </div>
    </div>
    <div id="plant-panel-photos" role="tabpanel" aria-labelledby="plant-tab-photos" hidden={section !== 'photos'}>
      <PlantPhotos plant={plant} disabled={busy} available={available} offline={offline} onBusyChange={onSpeciesBusy} onChanged={onChanged}/>
    </div>
    <div id="plant-panel-history" role="tabpanel" aria-labelledby="plant-tab-history" hidden={section !== 'history'}>
      <div className="detail-section-heading"><h2>Verlauf <span className="muted">{formatNumber(activities.length)}</span></h2><button ref={noteLauncher} className="secondary" disabled={offline || busy} onClick={() => setAddingNote(value => !value)}><Plus size={18} aria-hidden="true"/>{addingNote ? 'Notiz schließen' : 'Notiz hinzufügen'}</button></div>
      {addingNote && <section className="detail-card new-note"><NoteForm offline={offline} save={async note => { const saved = await record(plant, 'note', note); if (saved) { setAddingNote(false); noteLauncher.current?.focus(); } return saved; }}/></section>}
      <div className="activity-filters" aria-label="Einträge filtern">{(['all', 'watering', 'fertilizing', 'photo', 'note'] as const).map(kind => <button key={kind} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{kind === 'all' ? 'Alle' : activityLabels[kind]}</button>)}</div>
      {activitiesLoading ? <p className="muted" role="status">Verlauf wird geladen…</p> : activitiesError ? <p className="alert" role="alert">Der Verlauf konnte nicht geladen werden. Öffne die Pflanze erneut, um es noch einmal zu versuchen.</p> : <div className="timeline">{activities.filter(item => filter === 'all' || item.type === filter).map(activity => <ActivityRow key={activity.id} activity={activity} offline={offline} timeZone={timeZone} onChanged={onChanged}/>)}{!activities.some(item => filter === 'all' || item.type === filter) && <div className="empty-card"><NotebookPen size={28}/><b>Keine Einträge für diese Auswahl</b><p>Trage Pflege ein, füge ein Foto oder eine Notiz hinzu.</p></div>}</div>}
    </div>
  </section>;
}

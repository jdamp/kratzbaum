import { useEffect, useRef, useState } from 'react';
import { activityLabels } from './api';
import type { DueCare, NotStartedCare, Plant } from './api';
import { CachedImage } from './PlantPhotos';

type CareItem = DueCare | NotStartedCare;
export type RecordCare = (plant: Plant, type: 'watering' | 'fertilizing' | 'note', note?: string, date?: string) => Promise<boolean>;

export function CareRow({ item, onRecord, onOpen, disabled }: { item: CareItem; onRecord?: () => void; onOpen?: () => void; disabled: boolean }) {
  const description = 'due_date' in item
    ? item.days_until > 0 ? `in ${item.days_until} ${item.days_until === 1 ? 'day' : 'days'}` : item.days_overdue > 0 ? `${item.days_overdue} days overdue` : 'due today'
    : `Every ${item.interval_days} days · not started`;
  return <div className="care-row" data-plant-id={item.plant_id} data-care-type={item.type}>
    <a className="care-photo" href={`/plants/${item.plant_id}`} aria-label={`Open ${item.plant_name}`} onClick={event => {
      if (onOpen && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onOpen(); }
    }}>{item.photo_url ? <CachedImage src={item.photo_url} alt={`Photo of ${item.plant_name}`}/> : <span aria-hidden="true">🌿</span>}</a>
    <div className="care-copy"><b>{item.plant_name}</b><small><span className={'care-type ' + item.type} aria-hidden="true">{item.type === 'watering' ? '◒' : '✳'}</span> {activityLabels[item.type]} · {description}</small></div>
    {onRecord && <button className="soft-button" onClick={onRecord} disabled={disabled}>{item.type === 'watering' ? 'Watered' : 'Fertilized'}</button>}
  </div>;
}

export function CareEntryDialog({ plant, type, offline, record, onClose }: { plant: Plant; type: 'watering' | 'fertilizing'; offline: boolean; record: RecordCare; onClose: () => void }) {
  const [date, setDate] = useState(() => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16); });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const launcher = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => { if (launcher?.isConnected) launcher.focus(); };
  }, []);
  const close = () => { if (!pending.current) onClose(); };
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <section ref={dialog} className="modal care-entry-dialog" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="care-entry-title" aria-busy={busy} onKeyDown={e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') {
        const controls = Array.from(dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { e.preventDefault(); return; }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus(); }
      }
    }}>
      <div className="modal-heading"><h2 id="care-entry-title">{type === 'watering' ? 'Record watering' : 'Record fertilizing'}</h2><button className="icon-button" aria-label="Close care entry" disabled={busy} onClick={close}>×</button></div>
      <p>{plant.name}</p>
      {error && <p role="alert" className="alert">{error}</p>}
      {offline && <p role="status" className="muted">You are offline. Connect to save care.</p>}
      <form onSubmit={async e => {
        e.preventDefault();
        if (pending.current || offline) return;
        pending.current = true; setBusy(true); setError('');
        if (await record(plant, type, '', new Date(date).toISOString())) onClose();
        else setError('Care was not confirmed. Your date is kept; check the connection and try again.');
        pending.current = false; setBusy(false);
      }}>
        <label>{type === 'watering' ? 'Watered at' : 'Fertilized at'}<input type="datetime-local" required value={date} onChange={e => setDate(e.target.value)} disabled={busy} aria-label={type === 'watering' ? 'Watering date and time' : 'Fertilizing date and time'}/></label>
        <div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy || offline}>{busy ? 'Saving…' : 'Save care'}</button></div>
        {busy && <p role="status">Saving care…</p>}
      </form>
    </section>
  </div>;
}

import { useEffect, useRef, useState } from 'react';
import { activityLabels } from './api';
import type { DueCare, NotStartedCare, Plant } from './api';
import { CachedImage } from './PlantPhotos';
import { dateTimeInput, everyDays, formatNumber, inputToInstant, InvalidDateTimeError, overdueDays } from './locale';

type CareItem = DueCare | NotStartedCare;
export type RecordCare = (plant: Plant, type: 'watering' | 'fertilizing' | 'note', note?: string, date?: string) => Promise<boolean>;

export function CareRow({ item, onRecord, onOpen, disabled }: { item: CareItem; onRecord?: () => void; onOpen?: () => void; disabled: boolean }) {
  const description = 'due_date' in item
    ? item.days_until > 0 ? `in ${formatNumber(item.days_until)} ${item.days_until === 1 ? 'Tag' : 'Tagen'}` : item.days_overdue > 0 ? overdueDays(item.days_overdue) : 'heute fällig'
    : `${everyDays(item.interval_days)} · noch nicht begonnen`;
  return <div className="care-row" data-plant-id={item.plant_id} data-care-type={item.type}>
    <a className="care-photo" href={`/plants/${item.plant_id}`} aria-label={`${item.plant_name} öffnen`} onClick={event => {
      if (onOpen && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onOpen(); }
    }}>{item.photo_url ? <CachedImage src={item.photo_url} alt={`Foto von ${item.plant_name}`}/> : <span aria-hidden="true">🌿</span>}</a>
    <div className="care-copy"><b>{item.plant_name}</b><small><span className={'care-type ' + item.type} aria-hidden="true">{item.type === 'watering' ? '◒' : '✳'}</span> {activityLabels[item.type]} · {description}</small></div>
    {onRecord && <button className="soft-button" onClick={onRecord} disabled={disabled}>{item.type === 'watering' ? 'Gegossen' : 'Gedüngt'}</button>}
  </div>;
}

export function CareEntryDialog({ plant, type, offline, record, onClose, timeZone, returnFocus }: { plant: Plant; type: 'watering' | 'fertilizing'; offline: boolean; record: RecordCare; onClose: () => void; timeZone: string; returnFocus?: HTMLElement | null }) {
  const [date, setDate] = useState(() => dateTimeInput(new Date(), timeZone));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const launcher = returnFocus ?? document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => { requestAnimationFrame(() => { if (!dialog.current?.isConnected && launcher?.isConnected) launcher.focus(); }); };
  }, []);
  const close = () => { if (!pending.current) onClose(); };
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <section ref={dialog} className="modal care-entry-dialog" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="care-entry-title" aria-busy={busy} onKeyDown={e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') {
        const controls = Array.from(dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)'));
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { e.preventDefault(); return; }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus(); }
      }
    }}>
      <div className="modal-heading"><h2 id="care-entry-title">{type === 'watering' ? 'Gießen eintragen' : 'Düngen eintragen'}</h2><button className="icon-button" aria-label="Pflegeeintrag schließen" disabled={busy} onClick={close}>×</button></div>
      <p>{plant.name}</p>
      {error && <p role="alert" className="alert">{error}</p>}
      {offline && <p role="status" className="muted">Du bist offline. Stelle eine Verbindung her, um die Pflege zu speichern.</p>}
      <form onSubmit={async e => {
        e.preventDefault();
        if (pending.current || offline) return;
        pending.current = true; setBusy(true); setError('');
        try {
          if (await record(plant, type, note, inputToInstant(date, timeZone))) onClose();
          else setError('Die Pflege wurde nicht bestätigt. Das Datum bleibt erhalten; prüfe die Verbindung und versuche es erneut.');
        } catch (e) { setError(e instanceof InvalidDateTimeError ? e.message : 'Das Datum ist ungültig.'); }
        finally { pending.current = false; setBusy(false); }
      }}>
        <label>{type === 'watering' ? 'Gegossen am' : 'Gedüngt am'}<input type="datetime-local" required value={date} onChange={e => setDate(e.target.value)} disabled={busy} aria-label={type === 'watering' ? 'Datum und Uhrzeit des Gießens' : 'Datum und Uhrzeit des Düngens'}/></label>
        <p className="muted">Datum und Uhrzeit lassen sich ändern.</p>
        <label>Notiz · optional<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={10000} disabled={busy} rows={3} placeholder="Zum Beispiel: Erde war sehr trocken."/></label>
        <p className="muted">Der nächste Pflegetermin wird nach dem Speichern neu berechnet.</p>
        <div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={close}>Abbrechen</button><button className="primary" aria-busy={busy} disabled={busy || offline}>{busy ? 'Wird gespeichert…' : 'Pflege speichern'}</button></div>
        {busy && <p role="status">Pflege wird gespeichert…</p>}
      </form>
    </section>
  </div>;
}

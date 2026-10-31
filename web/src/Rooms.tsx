import { useRef, useState } from 'react';
import { ApiError, send } from './api';
import type { Room } from './api';

export type RoomSelection = 'all' | 'unassigned' | string;
export type RoomChange = { type: 'saved'; room: Room } | { type: 'deleted'; id: string };

export function inRoom(item: { room_id?: string | null }, selection: RoomSelection) {
  return selection === 'all' || (selection === 'unassigned' ? !item.room_id : item.room_id === selection);
}

export function RoomFilter({ rooms, selected, onChange, unavailable }: { rooms: Room[]; selected: RoomSelection; onChange: (value: RoomSelection) => void; unavailable: boolean }) {
  return <label className="room-filter">Raum
    <select aria-label="Nach Raum filtern" value={selected} onChange={e => onChange(e.target.value)}>
      <option value="all">Alle Räume</option>
      <option value="unassigned">Nicht zugeordnet</option>
      {rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
      {selected !== 'all' && selected !== 'unassigned' && !rooms.some(room => room.id === selected) && <option value={selected}>Rauminformationen nicht verfügbar</option>}
    </select>
    {unavailable && <span className="muted" role="status">Rauminformationen sind nicht verfügbar. Stelle eine Verbindung her und versuche es erneut.</span>}
  </label>;
}

export function RoomManager({ rooms, offline, unavailable, onChanged }: { rooms: Room[]; offline: boolean; unavailable: boolean; onChanged: (change: RoomChange) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const mutate = async (operation: () => Promise<RoomChange>, saved: () => void) => {
    if (pending.current || offline || unavailable) return;
    pending.current = true; setBusy(true); setError(''); setStatus('');
    try {
      const change = await operation();
      onChanged(change);
      saved();
      setStatus(change.type === 'saved' ? `Raum „${change.room.name}“ gespeichert.` : 'Raum gelöscht. Seine Pflanzen sind jetzt nicht zugeordnet.');
    }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Raumänderungen konnten nicht gespeichert werden.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <section className="room-manager" aria-labelledby="rooms-heading" aria-busy={busy}>
    <h2 id="rooms-heading">Räume verwalten</h2>
    <p className="muted">Ordne deine Pflanzen nach ihrem Standort.</p>
    {(offline || unavailable) && <p className="muted" role="status">{offline ? 'Du bist offline. Räume können nicht geändert werden.' : 'Rauminformationen sind nicht verfügbar. Lade deine Sammlung erneut.'}</p>}
    {error && <p role="alert" className="alert">{error}</p>}
    {busy && <p role="status">Raumänderungen werden gespeichert…</p>}
    {status && <p role="status" className="room-success">{status}</p>}
    <form onSubmit={e => {
      e.preventDefault();
      void mutate(async () => ({ type: 'saved', room: await send<Room>(editing ? `/api/rooms/${editing}` : '/api/rooms', { name }, editing ? 'PUT' : 'POST') }), () => { setName(''); setEditing(null); });
    }}>
      <label>{editing ? 'Raum umbenennen' : 'Name des neuen Raums'}<input ref={input} required maxLength={120} value={name} onChange={e => setName(e.target.value)} disabled={busy || offline || unavailable}/></label>
      <div className="room-actions">
        <button className="primary" aria-busy={busy} disabled={busy || offline || unavailable || !name.trim()}>{busy ? 'Wird gespeichert…' : editing ? 'Raumnamen speichern' : 'Raum hinzufügen'}</button>
        {editing && <button type="button" className="secondary" disabled={busy} onClick={() => { setEditing(null); setName(''); setError(''); }}>Umbenennen abbrechen</button>}
      </div>
    </form>
    {rooms.length > 0 ? <ul className="room-list">{rooms.map(room => <li key={room.id}>
      <b>{room.name}</b>
      <div className="room-actions">
        <button type="button" className="secondary" disabled={busy || offline || unavailable} aria-label={`${room.name} umbenennen`} onClick={() => { setEditing(room.id); setName(room.name); setError(''); input.current?.focus(); }}>Umbenennen</button>
        <button type="button" className="secondary" disabled={busy || offline || unavailable} aria-label={`${room.name} löschen`} onClick={() => {
          if (!window.confirm(`${room.name} löschen? Die Pflanzen werden keinem Raum mehr zugeordnet. Pflanzen und Pflegeverlauf bleiben erhalten.`)) return;
          void mutate(async () => { await send(`/api/rooms/${room.id}`, undefined, 'DELETE'); return { type: 'deleted', id: room.id }; }, () => { if (editing === room.id) { setEditing(null); setName(''); } });
        }}>Löschen</button>
      </div>
    </li>)}</ul> : !unavailable && <p className="muted">Noch keine Räume vorhanden. Pflanzen können auch ohne Raum bleiben.</p>}
  </section>;
}

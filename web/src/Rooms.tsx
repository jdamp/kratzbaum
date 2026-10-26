import { useRef, useState } from 'react';
import { send } from './api';
import type { Room } from './api';

export type RoomSelection = 'all' | 'unassigned' | string;

export function inRoom(item: { room_id?: string | null }, selection: RoomSelection) {
  return selection === 'all' || (selection === 'unassigned' ? !item.room_id : item.room_id === selection);
}

export function RoomFilter({ rooms, selected, onChange, unavailable }: { rooms: Room[]; selected: RoomSelection; onChange: (value: RoomSelection) => void; unavailable: boolean }) {
  return <label className="room-filter">Room
    <select aria-label="Filter by room" value={selected} onChange={e => onChange(e.target.value)}>
      <option value="all">All rooms</option>
      <option value="unassigned">Unassigned</option>
      {rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
      {selected !== 'all' && selected !== 'unassigned' && !rooms.some(room => room.id === selected) && <option value={selected}>Room information unavailable</option>}
    </select>
    {unavailable && <span className="muted" role="status">Room information is unavailable. Connect and retry to refresh rooms.</span>}
  </label>;
}

export function RoomManager({ rooms, offline, unavailable, onChanged }: { rooms: Room[]; offline: boolean; unavailable: boolean; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const mutate = async (operation: () => Promise<unknown>, saved: () => void) => {
    if (pending.current || offline) return;
    pending.current = true; setBusy(true); setError('');
    try { await operation(); saved(); await onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save room changes'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <section className="room-manager" aria-labelledby="rooms-heading" aria-busy={busy}>
    <h2 id="rooms-heading">Manage rooms</h2>
    <p className="muted">Organize plants by where you care for them.</p>
    {(offline || unavailable) && <p className="muted" role="status">{offline ? 'You are offline. Room changes are unavailable.' : 'Room information is unavailable. Retry loading your collection.'}</p>}
    {error && <p role="alert" className="alert">{error}</p>}
    {busy && <p role="status">Saving room changes…</p>}
    <form onSubmit={e => {
      e.preventDefault();
      void mutate(() => send(editing ? `/api/rooms/${editing}` : '/api/rooms', { name }, editing ? 'PUT' : 'POST'), () => { setName(''); setEditing(null); });
    }}>
      <label>{editing ? 'Rename room' : 'New room name'}<input ref={input} required maxLength={120} value={name} onChange={e => setName(e.target.value)} disabled={busy || offline || unavailable}/></label>
      <div className="room-actions">
        <button className="primary" disabled={busy || offline || unavailable || !name.trim()}>{busy ? 'Saving…' : editing ? 'Save room name' : 'Add room'}</button>
        {editing && <button type="button" className="secondary" disabled={busy} onClick={() => { setEditing(null); setName(''); setError(''); }}>Cancel rename</button>}
      </div>
    </form>
    {rooms.length > 0 ? <ul className="room-list">{rooms.map(room => <li key={room.id}>
      <b>{room.name}</b>
      <div className="room-actions">
        <button type="button" className="secondary" disabled={busy || offline || unavailable} aria-label={`Rename ${room.name}`} onClick={() => { setEditing(room.id); setName(room.name); setError(''); input.current?.focus(); }}>Rename</button>
        <button type="button" className="secondary" disabled={busy || offline || unavailable} aria-label={`Delete ${room.name}`} onClick={() => {
          if (!window.confirm(`Delete ${room.name}? Its plants will become unassigned. Plants and care history will be kept.`)) return;
          void mutate(() => send(`/api/rooms/${room.id}`, undefined, 'DELETE'), () => { if (editing === room.id) { setEditing(null); setName(''); } });
        }}>Delete</button>
      </div>
    </li>)}</ul> : !unavailable && <p className="muted">No rooms yet. Plants can stay unassigned.</p>}
  </section>;
}

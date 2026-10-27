import { useEffect, useRef, useState } from 'react';
import { get, send } from './api';
import type { Plant, PlantInput, Room } from './api';

export function PlantRoom({ plant, rooms, offline, unavailable, disabled, onBusyChange, onSaveStart, onSaved }: {
  plant: Plant; rooms: Room[]; offline: boolean; unavailable: boolean; disabled: boolean;
  onBusyChange: (busy: boolean) => void; onSaveStart: () => void; onSaved: (plant: Plant) => void;
}) {
  const [roomID, setRoomID] = useState(plant.room_id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const pending = useRef(false);
  const active = useRef(true);
  const canWrite = useRef(false);
  canWrite.current = !offline && !unavailable && !disabled;
  useEffect(() => { setRoomID(plant.room_id ?? ''); }, [plant.room_id]);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; onBusyChange(false); };
  }, [onBusyChange]);
  const validRoom = !roomID || rooms.some(room => room.id === roomID);
  const unchanged = roomID === (plant.room_id ?? '');
  return <form className="plant-room-form" aria-label="Plant room" aria-busy={busy} onSubmit={async event => {
    event.preventDefault();
    if (pending.current || !canWrite.current || unchanged || !validRoom) return;
    pending.current = true; setBusy(true); onBusyChange(true); onSaveStart(); setError(''); setStatus('');
    try {
      const { plant: latest } = await get<{ plant: Plant }>(`/api/plants/${plant.id}`);
      // Leaving this detail or losing access before the read completes cancels the write.
      if (!active.current || !canWrite.current) return;
      const input: PlantInput = {
        name: latest.name, scientific_name: latest.scientific_name, common_name: latest.common_name,
        family: latest.family, notes: latest.notes, care_start_date: latest.care_start_date,
        watering_interval_days: latest.watering_interval_days,
        summer_fertilizing_interval_days: latest.summer_fertilizing_interval_days,
        winter_fertilizing_interval_days: latest.winter_fertilizing_interval_days,
        summer_fertilizing_paused: latest.summer_fertilizing_paused,
        winter_fertilizing_paused: latest.winter_fertilizing_paused, room_id: roomID || null,
      };
      const saved = await send<Plant>(`/api/plants/${plant.id}`, input, 'PUT');
      onSaved(saved);
      if (active.current) setStatus('Room assignment saved.');
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : 'Could not change the plant’s room');
    } finally {
      pending.current = false;
      if (active.current) { setBusy(false); onBusyChange(false); }
    }
  }}>
    <label>Room<select value={roomID} disabled={busy || offline || unavailable || disabled} onChange={event => {
      setRoomID(event.target.value); setError(''); setStatus('');
    }}>
      <option value="">Unassigned</option>
      {rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
      {!validRoom && <option value={roomID}>{unavailable ? 'Room information unavailable' : 'Room no longer available'}</option>}
    </select></label>
    <button className="primary" aria-busy={busy} disabled={busy || offline || unavailable || disabled || unchanged || !validRoom}>{busy ? 'Saving room…' : 'Save room'}</button>
    {offline ? <p className="muted" role="status">You are offline. Room changes are unavailable.</p> : unavailable && <p className="muted" role="status">Room information is unavailable. Retry loading your collection.</p>}
    {status && <p className="muted" role="status">{status}</p>}
    {error && <p className="alert" role="alert">{error}</p>}
  </form>;
}

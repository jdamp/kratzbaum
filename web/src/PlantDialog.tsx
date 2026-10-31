import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, send, uploadPhoto } from './api';
import type { Plant, PlantInput, Room } from './api';
import { RoomManager } from './Rooms';
import type { RoomChange } from './Rooms';
import { Identification, photoTypes } from './Identification';
import { dateOnly, everyDays } from './locale';


function PhotoPicker({ file, disabled, onChange }: { file: File | null; disabled: boolean; onChange: (file: File | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <div className="creation-photo">
    <label htmlFor="creation-photo-input">Pflanzenfoto · optional</label>
    <input ref={input} id="creation-photo-input" hidden type="file" accept={photoTypes} disabled={disabled} onChange={e => {
      const selected = e.target.files?.[0];
      e.target.value = '';
      if (selected) onChange(selected);
    }}/>
    <div className="creation-photo-card">
      {file ? <>
        <div className="creation-photo-selection">
          {preview?.file === file && !failed ? <img src={preview.url} alt="Vorschau des ausgewählten Pflanzenfotos" onError={() => setFailed(true)}/> : <span className="creation-photo-fallback" aria-hidden="true">Foto</span>}
          <div><b>{file.name}</b><p className="muted">{failed ? 'Keine Vorschau verfügbar. Dein Foto kann trotzdem hochgeladen werden.' : 'Ausgewähltes Foto. Das erste Foto wird zum Titelbild.'}</p></div>
        </div>
        <div className="creation-photo-actions"><button type="button" className="secondary" disabled={disabled} onClick={() => input.current?.click()}>Ersetzen</button><button type="button" className="secondary" disabled={disabled} onClick={() => onChange(null)}>Entfernen</button></div>
      </> : <><b>Füge ein Foto hinzu, um deine Pflanze wiederzuerkennen</b><p className="muted">JPG, PNG, WebP oder HEIC</p><button type="button" className="secondary" disabled={disabled} onClick={() => input.current?.click()}>Foto auswählen</button></>}
    </div>
  </div>;
}

export function PlantDialog({ editing, available, offline, rooms, roomsUnavailable, onRoomsChanged, onClose, onSaved }: { editing: Plant | null; available: boolean; offline: boolean; rooms: Room[]; roomsUnavailable: boolean; onRoomsChanged: (change: RoomChange) => void; onClose: () => void; onSaved: () => void }) {
  const [managingRooms, setManagingRooms] = useState(false);
  const wasManaging = useRef(false);
  const [roomID, setRoomID] = useState(editing?.room_id ?? '');
  useEffect(() => { if (!roomsUnavailable && roomID && !rooms.some(room => room.id === roomID)) setRoomID(''); }, [rooms, roomsUnavailable, roomID]);
  const [scientificName, setScientificName] = useState(editing?.scientific_name ?? '');
  const [commonName, setCommonName] = useState('');
  const [identifying, setIdentifying] = useState(false);
  const identificationPending = useRef(false);
  const identificationBusy = useCallback((value: boolean) => { identificationPending.current = value; setIdentifying(value); }, []);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<'draft' | 'saving' | 'uploading' | 'photo-error'>('draft');
  const [savedPlant, setSavedPlant] = useState<Plant | null>(null);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const confirmedPlant = useRef<Plant | null>(null);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (managingRooms) dialog.current?.querySelector<HTMLInputElement>('.room-manager input')?.focus();
    else if (wasManaging.current) dialog.current?.querySelector<HTMLButtonElement>('.manage-rooms-button')?.focus();
    wasManaging.current = managingRooms;
  }, [managingRooms]);
  useEffect(() => {
    if (phase === 'photo-error') {
      dialog.current?.scrollTo({ top: 0 });
      dialog.current?.querySelector<HTMLElement>('[role=alert]')?.focus();
    }
  }, [phase]);
  const saving = phase === 'saving' || phase === 'uploading';
  const busy = saving || identifying;
  useEffect(() => {
    const launcher = document.activeElement as HTMLElement | null;
    if (!dialog.current?.contains(document.activeElement)) dialog.current?.focus();
    return () => { if (launcher?.isConnected) launcher.focus(); };
  }, []);
  const finish = () => { onClose(); onSaved(); };
  const close = () => { if (inFlight.current) return; if (managingRooms) { setManagingRooms(false); return; } if (confirmedPlant.current) finish(); else onClose(); };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || identificationPending.current || offline) return;
    const fd = new FormData(event.currentTarget), v = (key: string) => String(fd.get(key) || ''), n = (key: string) => v(key) ? Number(v(key)) : null;
    const input: PlantInput = { name: v('name').trim(), scientific_name: v('scientific_name'), common_name: editing?.common_name ?? commonName, family: editing?.family ?? '', notes: v('notes'), care_start_date: v('care_start_date'), ...(roomsUnavailable ? {} : { room_id: roomID || null }), watering_interval_days: Number(v('watering_interval_days')), summer_fertilizing_interval_days: n('summer'), winter_fertilizing_interval_days: n('winter'), summer_fertilizing_paused: fd.has('summer_paused'), winter_fertilizing_paused: fd.has('winter_paused') };
    inFlight.current = true;
    setError('');
    if (!confirmedPlant.current) {
      setPhase('saving');
      try {
        const saved = await send<Plant>(editing ? '/api/plants/' + editing.id : '/api/plants', input, editing ? 'PUT' : 'POST');
        if (editing) { finish(); return; }
        confirmedPlant.current = saved;
        setSavedPlant(saved);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Die Pflanze konnte nicht gespeichert werden.');
        setPhase('draft');
        inFlight.current = false;
        return;
      }
    }
    if (file) {
      setPhase('uploading');
      try { await uploadPhoto(confirmedPlant.current.id, file); }
      catch (e) {
        const message = e instanceof ApiError && e.status === 0 ? 'Der Foto-Upload konnte nicht bestätigt werden. Prüfe vor einem erneuten Versuch deine Verbindung.' : e instanceof ApiError ? e.message : 'Das Foto konnte nicht hochgeladen werden.';
        setError(message);
        setPhase('photo-error');
        inFlight.current = false;
        return;
      }
    }
    finish();
  };
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <section ref={dialog} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title" aria-busy={busy} onKeyDown={e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') {
        const controls = Array.from(dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([hidden]), textarea:not(:disabled), select:not(:disabled)')).filter(el => el.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { e.preventDefault(); return; }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus(); }
      }
    }}>
      <div className="modal-heading"><div><p className="eyebrow">{editing ? 'SAMMLUNGSDETAILS' : 'NEUZUGANG'}</p><h2 id="form-title">{editing ? 'Pflanze bearbeiten' : phase === 'photo-error' ? 'Pflanze fertig hinzufügen' : 'Pflanze hinzufügen'}</h2></div><button className="icon-button" aria-label="Schließen" disabled={saving} onClick={close}>×</button></div>
      {error && <div className="alert creation-error" role="alert" tabIndex={-1}>{savedPlant && <b>Pflanze gespeichert. Beim Foto ist ein Problem aufgetreten.</b>}<span>{error}</span>{savedPlant && <span>Deine Pflanzendaten sind gespeichert.</span>}</div>}
      {saving && <p className="creation-progress" role="status">{phase === 'saving' ? 'Pflanze wird gespeichert…' : 'Pflanze gespeichert. Foto wird hochgeladen…'}</p>}
      {managingRooms && <div><button type="button" className="text-button" onClick={() => setManagingRooms(false)}>← Zurück zur Pflanze</button><RoomManager rooms={rooms} offline={offline} unavailable={roomsUnavailable} onChanged={onRoomsChanged}/></div>}
      <form onSubmit={submit} hidden={managingRooms}>
        {savedPlant && <div className="saved-plant-summary"><h3>{savedPlant.name}</h3><p className="muted">{[savedPlant.scientific_name, savedPlant.common_name].filter(Boolean).join(' · ')}</p><p className="muted">{savedPlant.care_start_date ? `Pflegebeginn: ${dateOnly(savedPlant.care_start_date, { day: '2-digit', month: '2-digit', year: 'numeric' })}` : 'Die Pflege beginnt mit dem ersten Eintrag'} · Gießen: {everyDays(savedPlant.watering_interval_days)}</p></div>}
        {!editing && <PhotoPicker file={file} disabled={busy} onChange={setFile}/>}
        {!editing && !savedPlant && <Identification source={file} available={available} offline={offline} disabled={saving} onBusyChange={identificationBusy} onConfirm={candidate => { setScientificName(candidate.scientific_name); setCommonName(candidate.common_names?.[0] ?? ''); }}/>}
        <fieldset className="plant-fields" disabled={busy || !!savedPlant || offline} hidden={!!savedPlant}>
          <label>Pflanzenname<input name="name" required maxLength={120} autoFocus defaultValue={editing?.name??''} placeholder="Monstera am Fenster"/></label><label>Wissenschaftlicher Name<input name="scientific_name" value={scientificName} onChange={e => { setScientificName(e.target.value); setCommonName(''); }} placeholder="Monstera deliciosa"/></label><label>Raum · optional<select name="room_id" value={roomID} onChange={e => setRoomID(e.target.value)} disabled={roomsUnavailable || offline}><option value="">Nicht zugeordnet</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}{roomID && !rooms.some(room => room.id === roomID) && <option value={roomID}>Rauminformationen nicht verfügbar</option>}</select></label>{roomsUnavailable && <p className="muted">Rauminformationen sind nicht verfügbar. Die bestehende Zuordnung bleibt erhalten.</p>}<button type="button" className="text-button manage-rooms-button" onClick={() => setManagingRooms(true)}>Räume verwalten</button><label>Pflegebeginn<input name="care_start_date" type="date" defaultValue={editing?.care_start_date??''} aria-describedby="care-start-help"/></label><p id="care-start-help" className="muted">Optional. Ohne Datum beginnen Gieß- und Düngeplan jeweils mit dem ersten Pflegeeintrag. Ein angegebenes Datum gilt bis zum ersten Eintrag der jeweiligen Art.</p><label>Gießabstand (Tage) <span className="inline-input"><input name="watering_interval_days" type="number" min="1" max="365" defaultValue={editing?.watering_interval_days??7} required/></span></label><div className="two-fields"><label>Düngeabstand im Sommer (Tage)<input name="summer" type="number" min="1" max="365" defaultValue={editing?.summer_fertilizing_interval_days??''} placeholder="Optional"/><span><input type="checkbox" name="summer_paused" defaultChecked={editing?.summer_fertilizing_paused??false}/> Im Sommer pausieren</span></label><label>Düngeabstand im Winter (Tage)<input name="winter" type="number" min="1" max="365" defaultValue={editing?.winter_fertilizing_interval_days??''} placeholder="Optional"/><span><input type="checkbox" name="winter_paused" defaultChecked={editing?.winter_fertilizing_paused??false}/> Im Winter pausieren</span></label></div><label>Pflegenotizen<textarea name="notes" rows={3} defaultValue={editing?.notes??''} placeholder="Licht, Luftfeuchtigkeit, wichtige Hinweise…"/></label>
        </fieldset>
        <div className={'modal-actions' + (savedPlant ? ' creation-recovery-actions' : '')}>
          {savedPlant ? <><button className="primary" disabled={busy || !file}>{busy ? 'Foto wird hochgeladen…' : 'Foto erneut hochladen'}</button><button type="button" className="secondary" disabled={busy} onClick={close}>Ohne Foto fortfahren</button></> : <><button type="button" className="secondary" disabled={saving} onClick={close}>Abbrechen</button><button className="primary" disabled={busy || offline}>{saving ? 'Pflanze wird gespeichert…' : editing ? 'Änderungen speichern' : 'Pflanze hinzufügen'}</button></>}
        </div>
        {savedPlant && !busy && <p className="muted">Beim erneuten Versuch wird diese gespeicherte Pflanze verwendet.</p>}
      </form>
    </section>
  </div>;
}

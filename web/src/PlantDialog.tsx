import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, send, uploadPhoto } from './api';
import type { Plant, PlantInput } from './api';
import { Identification, photoTypes } from './Identification';

const todayISO = () => new Date().toISOString().slice(0, 10);

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
    <label htmlFor="creation-photo-input">Plant photo · optional</label>
    <input ref={input} id="creation-photo-input" hidden type="file" accept={photoTypes} disabled={disabled} onChange={e => {
      const selected = e.target.files?.[0];
      e.target.value = '';
      if (selected) onChange(selected);
    }}/>
    <div className="creation-photo-card">
      {file ? <>
        <div className="creation-photo-selection">
          {preview?.file === file && !failed ? <img src={preview.url} alt="Selected plant photo preview" onError={() => setFailed(true)}/> : <span className="creation-photo-fallback" aria-hidden="true">Photo</span>}
          <div><b>{file.name}</b><p className="muted">{failed ? 'Preview unavailable. Your photo can still be uploaded.' : 'Selected photo. First photo becomes the cover.'}</p></div>
        </div>
        <div className="creation-photo-actions"><button type="button" className="secondary" disabled={disabled} onClick={() => input.current?.click()}>Replace</button><button type="button" className="secondary" disabled={disabled} onClick={() => onChange(null)}>Remove</button></div>
      </> : <><b>Add a photo to recognize your plant</b><p className="muted">JPG, PNG, WebP or HEIC</p><button type="button" className="secondary" disabled={disabled} onClick={() => input.current?.click()}>Choose photo</button></>}
    </div>
  </div>;
}

export function PlantDialog({ editing, available, offline, onClose, onSaved }: { editing: Plant | null; available: boolean; offline: boolean; onClose: () => void; onSaved: () => void }) {
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
  const close = () => { if (inFlight.current) return; if (confirmedPlant.current) finish(); else onClose(); };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || identificationPending.current) return;
    const fd = new FormData(event.currentTarget), v = (key: string) => String(fd.get(key) || ''), n = (key: string) => v(key) ? Number(v(key)) : null;
    const input: PlantInput = { name: v('name').trim(), scientific_name: v('scientific_name'), common_name: editing?.common_name ?? commonName, family: editing?.family ?? '', notes: v('notes'), care_start_date: v('care_start_date'), watering_interval_days: Number(v('watering_interval_days')), summer_fertilizing_interval_days: n('summer'), winter_fertilizing_interval_days: n('winter'), summer_fertilizing_paused: fd.has('summer_paused'), winter_fertilizing_paused: fd.has('winter_paused') };
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
        setError(e instanceof Error ? e.message : 'Unable to save plant');
        setPhase('draft');
        inFlight.current = false;
        return;
      }
    }
    if (file) {
      setPhase('uploading');
      try { await uploadPhoto(confirmedPlant.current.id, file); }
      catch (e) {
        const message = e instanceof ApiError && e.status === 0 ? 'The photo upload could not be confirmed. Check your connection before retrying.' : e instanceof Error ? e.message : 'The photo could not be uploaded.';
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
        const controls = Array.from(dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([hidden]), textarea:not(:disabled)')).filter(el => el.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { e.preventDefault(); return; }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus(); }
      }
    }}>
      <div className="modal-heading"><div><p className="eyebrow">{editing ? 'COLLECTION DETAILS' : 'NEW ADDITION'}</p><h2 id="form-title">{editing ? 'Edit plant' : phase === 'photo-error' ? 'Finish adding your plant' : 'Add a plant'}</h2></div><button className="icon-button" aria-label="Close" disabled={saving} onClick={close}>×</button></div>
      {error && <div className="alert creation-error" role="alert" tabIndex={-1}>{savedPlant && <b>Plant saved. Photo needs attention.</b>}<span>{error}</span>{savedPlant && <span>Your plant details are safe.</span>}</div>}
      {saving && <p className="creation-progress" role="status">{phase === 'saving' ? 'Saving plant…' : 'Plant saved. Uploading photo…'}</p>}
      <form onSubmit={submit}>
        {savedPlant && <div className="saved-plant-summary"><h3>{savedPlant.name}</h3><p className="muted">{[savedPlant.scientific_name, savedPlant.common_name].filter(Boolean).join(' · ')}</p><p className="muted">Care started {savedPlant.care_start_date} · Water every {savedPlant.watering_interval_days} days</p></div>}
        {!editing && <PhotoPicker file={file} disabled={busy} onChange={setFile}/>}
        {!editing && !savedPlant && <Identification source={file} available={available} offline={offline} disabled={saving} onBusyChange={identificationBusy} onConfirm={candidate => { setScientificName(candidate.scientific_name); setCommonName(candidate.common_names?.[0] ?? ''); }}/>}
        <fieldset className="plant-fields" disabled={busy || !!savedPlant} hidden={!!savedPlant}>
          <label>Plant name<input name="name" required maxLength={120} autoFocus defaultValue={editing?.name??''} placeholder="Monstera by the window"/></label><label>Scientific name<input name="scientific_name" value={scientificName} onChange={e => { setScientificName(e.target.value); setCommonName(''); }} placeholder="Monstera deliciosa"/></label><label>Care started<input name="care_start_date" type="date" required defaultValue={editing?.care_start_date??todayISO()}/></label><label>Water every <span className="inline-input"><input name="watering_interval_days" type="number" min="1" max="365" defaultValue={editing?.watering_interval_days??7} required/> days</span></label><div className="two-fields"><label>Summer fertilizer interval (days)<input name="summer" type="number" min="1" max="365" defaultValue={editing?.summer_fertilizing_interval_days??''} placeholder="Optional"/><span><input type="checkbox" name="summer_paused" defaultChecked={editing?.summer_fertilizing_paused??false}/> Pause in summer</span></label><label>Winter fertilizer interval (days)<input name="winter" type="number" min="1" max="365" defaultValue={editing?.winter_fertilizing_interval_days??''} placeholder="Optional"/><span><input type="checkbox" name="winter_paused" defaultChecked={editing?.winter_fertilizing_paused??false}/> Pause in winter</span></label></div><label>Care notes<textarea name="notes" rows={3} defaultValue={editing?.notes??''} placeholder="Light, humidity, advice to remember…"/></label>
        </fieldset>
        <div className={'modal-actions' + (savedPlant ? ' creation-recovery-actions' : '')}>
          {savedPlant ? <><button className="primary" disabled={busy || !file}>{busy ? 'Uploading photo…' : 'Retry photo'}</button><button type="button" className="secondary" disabled={busy} onClick={close}>Continue without photo</button></> : <><button type="button" className="secondary" disabled={saving} onClick={close}>Cancel</button><button className="primary" disabled={busy}>{saving ? 'Saving plant…' : editing ? 'Save changes' : 'Add plant'}</button></>}
        </div>
        {savedPlant && !busy && <p className="muted">Retry uses this saved plant.</p>}
      </form>
    </section>
  </div>;
}

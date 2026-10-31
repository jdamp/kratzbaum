import { useEffect, useId, useRef, useState } from 'react';
import { ApiError, identificationError, identifyDraft, identifyPlantFile, identifySavedPhoto } from './api';
import type { SpeciesCandidate } from './api';
import { formatPercent } from './locale';

export const photoTypes = 'image/jpeg,image/png,image/webp,image/heic,.heic,.heif';
type Source = File | string | null;

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return online;
}

type IdentificationOptions = {
  source?: Source;
  plantID?: string;
  available: boolean;
  offline: boolean;
  disabled?: boolean;
  onConfirm: (candidate: SpeciesCandidate) => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
};

export function useIdentification({ source: inputSource, plantID, available, offline, disabled = false, onConfirm, onBusyChange }: IdentificationOptions) {
  const [selectedSource, setSelectedSource] = useState<Source>(null);
  const source = inputSource === undefined ? selectedSource : inputSource;
  const [phase, setPhase] = useState<'idle' | 'identifying' | 'saving'>('idle');
  const [error, setError] = useState('');
  const [results, setResults] = useState<{ source: Source; candidates: SpeciesCandidate[] } | null>(null);
  const [chosen, setChosen] = useState<SpeciesCandidate | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const current = useRef({ source, plantID });
  current.current = { source, plantID };
  const busy = phase !== 'idle';
  useEffect(() => {
    generation.current++;
    pending.current = false;
    setPhase('idle'); setResults(null); setChosen(null); setError('');
    if (inputSource === undefined) setSelectedSource(null);
    onBusyChange?.(false);
    return () => { generation.current++; onBusyChange?.(false); };
  }, [inputSource, plantID, onBusyChange]);
  const unavailable = !available ? 'Die Pflanzenbestimmung ist nicht eingerichtet. Du kannst den wissenschaftlichen Namen selbst eingeben.' : offline ? 'Die Pflanzenbestimmung ist offline nicht verfügbar. Stelle eine Verbindung her, um eine Pflanze zu bestimmen.' : '';
  const candidates = results?.source === source ? results.candidates : [];
  const locked = disabled || !!unavailable;
  const active = (token: number, startedSource: Source, startedPlant: string | undefined) =>
    token === generation.current && current.current.source === startedSource && current.current.plantID === startedPlant;
  const start = async (nextSource: Source = source) => {
    if (!nextSource || pending.current || locked) return;
    const source = nextSource;
    current.current = { source, plantID };
    if (inputSource === undefined) setSelectedSource(source);
    pending.current = true;
    onBusyChange?.(true);
    const token = ++generation.current;
    const startedSource = source, startedPlant = plantID;
    setPhase('identifying'); setResults(null); setChosen(null); setError('');
    try {
      const key = crypto.randomUUID();
      const result = typeof source === 'string'
        ? await identifySavedPhoto(plantID!, source, key)
        : plantID ? await identifyPlantFile(plantID, source, key) : await identifyDraft(source, key);
      if (!active(token, startedSource, startedPlant)) return;
      if (result.status !== 'succeeded' || !result.candidates?.length) {
        setError(identificationError(result.error_code || (result.status === 'no_match' ? 'plantnet_no_match' : undefined)));
      } else setResults({ source, candidates: result.candidates });
    } catch (e) {
      if (active(token, startedSource, startedPlant)) setError(e instanceof ApiError ? e.message : 'Die Bestimmung ist fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      if (active(token, startedSource, startedPlant)) { pending.current = false; setPhase('idle'); onBusyChange?.(false); }
    }
  };
  const confirm = async () => {
    if (!chosen || !candidates.includes(chosen) || pending.current || locked) return;
    pending.current = true;
    onBusyChange?.(true);
    const token = generation.current, startedSource = source, startedPlant = plantID;
    setPhase('saving'); setError('');
    try {
      await onConfirm(chosen);
      if (active(token, startedSource, startedPlant)) { setResults(null); setChosen(null); }
    } catch (e) {
      if (active(token, startedSource, startedPlant)) setError(e instanceof ApiError ? e.message : 'Die Art konnte nicht gespeichert werden. Bestätige erneut, um es noch einmal zu versuchen.');
    } finally {
      if (active(token, startedSource, startedPlant)) { pending.current = false; setPhase('idle'); onBusyChange?.(false); }
    }
  };
  const cancel = () => {
    generation.current++;
    pending.current = false;
    setPhase('idle'); setResults(null); setChosen(null); setError('');
    if (inputSource === undefined) { setSelectedSource(null); current.current.source = null; }
    onBusyChange?.(false);
  };
  return { source, plantID, phase, busy, locked, unavailable, error, candidates, chosen, choose: setChosen, start, confirm, cancel };
}

type Controller = ReturnType<typeof useIdentification>;

export function Identification(options: IdentificationOptions & { source: Source }) {
  const controller = useIdentification(options);
  return <IdentificationReview controller={controller} showStart/>;
}

export function IdentificationReview({ controller, showStart = false }: { controller: Controller; showStart?: boolean }) {
  const group = useId();
  const { source, plantID, phase, busy, locked, unavailable, error, candidates, chosen, choose, start, confirm, cancel } = controller;
  return <div className="identify-control" aria-busy={busy}>
    {showStart && <button type="button" className="secondary" disabled={!source || busy || locked} onClick={() => void start()}>Pflanze bestimmen</button>}
    {unavailable && <p className="muted">{unavailable}</p>}
    {busy && <p role="status">{phase === 'identifying' ? 'Pflanze wird bestimmt…' : plantID ? 'Art wird gespeichert…' : 'Art wird in den Entwurf übernommen…'}</p>}
    {error && <p role="alert">{error}</p>}
    {candidates.length > 0 && <div className="candidate-list">
      <h3 id={group + '-title'}>Vorschläge prüfen</h3>
      <p className="muted">{plantID ? 'Deine Pflanzendaten ändern sich erst, wenn du eine Art bestätigst.' : 'Bestätige eine Art, um den Entwurf auszufüllen. Die Pflanze wird separat gespeichert.'}</p>
      <div role="radiogroup" aria-labelledby={group + '-title'}>
        {candidates.map((c, i) => <label className="candidate" key={i}>
          <input type="radio" name={group} checked={chosen === c} disabled={busy || locked} onChange={() => choose(c)}/>
          <span><b>{c.scientific_name}</b><small>{c.common_names?.join(', ') || 'Wissenschaftlicher Name'}</small></span>
          <small>{formatPercent(c.score)}</small>
        </label>)}
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary" disabled={busy} onClick={cancel}>Bestimmung abbrechen</button>
        <button type="button" className="primary" disabled={!chosen || !candidates.includes(chosen) || busy || locked} onClick={() => void confirm()}>Art bestätigen</button>
      </div>
    </div>}
  </div>;
}

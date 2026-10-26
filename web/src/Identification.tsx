import { useEffect, useId, useRef, useState } from 'react';
import { identifyDraft, identifyPlantFile, identifySavedPhoto } from './api';
import type { SpeciesCandidate } from './api';

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

export function Identification({ source, plantID, available, offline, disabled = false, onConfirm, onBusyChange }: {
  source: Source;
  plantID?: string;
  available: boolean;
  offline: boolean;
  disabled?: boolean;
  onConfirm: (candidate: SpeciesCandidate) => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const group = useId();
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
    setPhase('idle'); setResults(null); setChosen(null); setError(''); onBusyChange?.(false);
    return () => { generation.current++; };
  }, [source, plantID, onBusyChange]);
  const unavailable = !available ? 'Species identification is not configured. You can enter the scientific name manually.' : offline ? 'Species identification is unavailable offline. Reconnect to identify.' : '';
  const candidates = results?.source === source ? results.candidates : [];
  const locked = disabled || !!unavailable;
  const active = (token: number, startedSource: Source, startedPlant: string | undefined) =>
    token === generation.current && current.current.source === startedSource && current.current.plantID === startedPlant;
  const identify = async () => {
    if (!source || pending.current || locked) return;
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
        setError(result.error || 'No likely species found. You can enter the scientific name manually.');
      } else setResults({ source, candidates: result.candidates });
    } catch (e) {
      if (active(token, startedSource, startedPlant)) setError(e instanceof Error ? e.message : 'Identification failed. Try again explicitly.');
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
      if (active(token, startedSource, startedPlant)) setError(e instanceof Error ? e.message : 'Could not save species. Confirm again to retry saving.');
    } finally {
      if (active(token, startedSource, startedPlant)) { pending.current = false; setPhase('idle'); onBusyChange?.(false); }
    }
  };
  return <div className="identify-control" aria-busy={busy}>
    <button type="button" className="secondary" disabled={!source || busy || locked} onClick={() => void identify()}>Identify species</button>
    {unavailable && <p className="muted">{unavailable}</p>}
    {busy && <p role="status">{phase === 'identifying' ? 'Identifying species…' : plantID ? 'Saving species…' : 'Applying species to draft…'}</p>}
    {error && <p role="alert">{error}</p>}
    {candidates.length > 0 && <div className="candidate-list">
      <h3 id={group + '-title'}>Review suggestions</h3>
      <p className="muted">{plantID ? 'Your plant details change only after you confirm a species.' : 'Confirm a species to fill this draft. Add plant saves it separately.'}</p>
      <div role="radiogroup" aria-labelledby={group + '-title'}>
        {candidates.map((c, i) => <label className="candidate" key={i}>
          <input type="radio" name={group} checked={chosen === c} disabled={busy || locked} onChange={() => setChosen(c)}/>
          <span><b>{c.scientific_name}</b><small>{c.common_names?.join(', ') || 'Scientific name'}</small></span>
          <small>{Math.round(c.score * 100)}%</small>
        </label>)}
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary" disabled={busy} onClick={() => { setResults(null); setChosen(null); setError(''); }}>Cancel identification</button>
        <button type="button" className="primary" disabled={!chosen || !candidates.includes(chosen) || busy || locked} onClick={() => void confirm()}>Confirm species</button>
      </div>
    </div>}
  </div>;
}

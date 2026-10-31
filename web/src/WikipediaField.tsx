import { useEffect, useRef, useState } from 'react';
import { normalizeWikipediaURL, resolveWikipedia, wikipediaURLHelp } from './wikipedia';

export function WikipediaField({ name, savedURL, online, disabled, onChange }: {
  name: string; savedURL: string; online: boolean; disabled: boolean;
  onChange: (url: string) => void;
}) {
  const [manual, setManual] = useState<string | null>(savedURL || null);
  const [automatic, setAutomatic] = useState({ name: '', url: '', status: '' });
  const [attempt, setAttempt] = useState(0);
  const intent = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController(), version = intent.current;
    if (manual !== null || !name.trim()) return () => controller.abort();
    if (!online) { setAutomatic({ name, url: '', status: 'Wikipedia konnte nicht geprüft werden.' }); return; }
    setAutomatic({ name, url: '', status: 'Wikipedia wird geprüft…' });
    resolveWikipedia(name, controller.signal).then(result => {
      if (!controller.signal.aborted && version === intent.current) setAutomatic({ name, url: result?.url || '', status: result ? 'Automatisch ermittelt' : 'Kein passender Artikel gefunden. Du kannst einen Link eingeben.' });
    }).catch(() => {
      if (!controller.signal.aborted && version === intent.current) setAutomatic({ name, url: '', status: 'Wikipedia konnte nicht geprüft werden. Du kannst einen Link selbst eingeben.' });
    });
    return () => controller.abort();
  }, [name, online, manual, attempt]);
  const value = manual ?? (automatic.name === name ? automatic.url : '');
  let normalized = '', invalid = false;
  try { normalized = normalizeWikipediaURL(value); } catch { invalid = true; }
  useEffect(() => { input.current?.setCustomValidity(invalid ? wikipediaURLHelp : ''); }, [invalid]);
  return <div className="wikipedia-field">
    <label>Wikipedia-Link · optional<input ref={input} type="url" value={value} disabled={disabled} placeholder="https://de.wikipedia.org/wiki/…" aria-describedby="wikipedia-help wikipedia-lookup" aria-invalid={invalid || undefined} onChange={event => {
      intent.current++;
      const next = event.target.value;
      setManual(next.trim() ? next : null);
      onChange(next);
    }}/></label>
    <p id="wikipedia-help" className="muted">Du kannst den automatisch gefundenen Link durch einen anderen Artikel ersetzen.</p>
    <p id="wikipedia-lookup" className="muted" role="status">{manual !== null ? 'Eigener Link' : automatic.name === name ? automatic.status : ''}</p>
    {invalid && <p className="field-error" role="alert">{wikipediaURLHelp}</p>}
    <div className="wikipedia-actions"><button type="button" className="secondary" disabled={disabled || !online} onClick={() => {
      intent.current++; setManual(null); onChange(''); setAttempt(value => value + 1);
    }}>Automatisch ermitteln</button>{normalized && !invalid && <a className="text-button" href={normalized} target="_blank" rel="noopener noreferrer" aria-label="Wikipedia-Artikel öffnen (öffnet einen neuen Tab)">Artikel öffnen ↗</a>}</div>
  </div>;
}

import { useEffect, useState } from 'react';
import { resolveWikipedia } from './wikipedia';
import type { WikipediaReference as Reference } from './wikipedia';

type State = { name: string; status: 'loading' | 'unavailable' | 'missing' | 'found'; reference?: Reference };

export function WikipediaReference({ name, online, override = '' }: { name: string; online: boolean; override?: string }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ name: '', status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    if (override || !name) return () => controller.abort();
    if (!online) {
      setState({ name, status: 'unavailable' });
    } else {
      setState({ name, status: 'loading' });
      resolveWikipedia(name, controller.signal).then(reference => {
        if (!controller.signal.aborted) setState(reference ? { name, status: 'found', reference } : { name, status: 'missing' });
      }).catch(() => {
        if (!controller.signal.aborted) setState({ name, status: 'unavailable' });
      });
    }
    return () => controller.abort();
  }, [name, online, attempt, override]);

  const current = state.name === name ? state : { name, status: 'loading' as const };
  const reference = override ? { url: override, language: new URL(override).hostname === 'en.wikipedia.org' ? 'en' : 'de' } : current.reference;
  if (override || current.status === 'found' && reference) {
    const language = reference?.language === 'en' ? ' (auf Englisch)' : '';
    return <a className="species-reference" href={reference?.url} target="_blank" rel="noopener noreferrer" aria-label={`${name || 'Artikel'} auf Wikipedia${language} (öffnet einen neuen Tab)`}>{name || 'Wikipedia'} <span aria-hidden="true">↗</span></a>;
  }
  if (!name) return null;
  return <>{name}{current.status === 'loading' && <small className="wiki-status" role="status"> Wikipedia wird geprüft…</small>}{current.status === 'unavailable' && <small className="wiki-status" role="status"> Wikipedia konnte nicht geprüft werden. {online && <button type="button" className="text-button" onClick={() => setAttempt(value => value + 1)}>Erneut versuchen</button>}</small>}</>;
}

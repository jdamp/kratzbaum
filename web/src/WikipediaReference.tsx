import { useEffect, useState } from 'react';
import { resolveWikipedia } from './wikipedia';
import type { WikipediaReference as Reference } from './wikipedia';

type State = { name: string; status: 'loading' | 'unavailable' | 'missing' | 'found'; reference?: Reference };

export function WikipediaReference({ name, online }: { name: string; online: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ name: '', status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
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
  }, [name, online, attempt]);

  const current = state.name === name ? state : { name, status: 'loading' as const };
  if (current.status === 'found' && current.reference) {
    const language = current.reference.language === 'en' ? ' (auf Englisch)' : '';
    return <a className="species-reference" href={current.reference.url} target="_blank" rel="noopener noreferrer" aria-label={`${name} auf Wikipedia${language} (öffnet einen neuen Tab)`}>{name} <span aria-hidden="true">↗</span></a>;
  }
  return <>{name}{current.status === 'loading' && <small className="wiki-status" role="status"> Wikipedia wird geprüft…</small>}{current.status === 'unavailable' && <small className="wiki-status" role="status"> Wikipedia konnte nicht geprüft werden. {online && <button type="button" className="text-button" onClick={() => setAttempt(value => value + 1)}>Erneut versuchen</button>}</small>}</>;
}

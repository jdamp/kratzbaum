import { useEffect, useState } from 'react';

export function LoginPage({ ready, loading, offline, error, loginURL, onRetry }: {
  ready: boolean; loading: boolean; offline: boolean; error: string; loginURL: string; onRetry: () => void;
}) {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  const disconnected = offline || !online;
  return <div className="login-page">
    <header className="login-brand"><span className="brand"><span className="brand-mark">k</span>kratzbaum</span></header>
    <main className="login-card">
      <div className="login-illustration" aria-hidden="true">
        <svg viewBox="0 0 240 180" fill="none"><ellipse cx="120" cy="162" rx="64" ry="8" fill="#d8e2d2"/><path d="M120 126V44M120 99L84 70M120 78L153 48" stroke="#33694b" strokeWidth="4" strokeLinecap="round"/><path d="M117 83C80 90 60 69 62 41C94 39 117 52 117 83Z" fill="#89a780"/><path d="M123 65C122 34 146 17 174 24C173 53 154 69 123 65Z" fill="#33694b"/><path d="M119 112C90 119 72 105 75 83C99 81 116 89 119 112Z" fill="#5f8959"/><path d="M124 105C124 82 144 70 164 76C162 98 146 109 124 105Z" fill="#a7bb92"/><path d="M92 122H148L140 157H100L92 122Z" fill="#ca9b72"/><path d="M90 122H150" stroke="#b1835d" strokeWidth="7" strokeLinecap="round"/></svg>
      </div>
      <p className="eyebrow">A LITTLE CARE, EVERY DAY</p>
      <h1>{ready ? 'Sign in to your collection' : 'Welcome to kratzbaum'}</h1>
      <p className="login-description">Your plants, photos and care history, together.</p>
      {loading && <p className="muted" role="status">Opening your collection…</p>}
      {error && <p className="login-error" role="alert">{error}</p>}
      {disconnected && <p className="muted" role="status">Connect to the server to sign in.</p>}
      {ready && !loading && (disconnected
        ? <button className="primary login-action" disabled>Sign-in unavailable offline</button>
        : <a className="primary login-action" href={loginURL}>Continue with your identity provider <span aria-hidden="true">→</span></a>)}
      {error && !loading && <button className="secondary login-action" onClick={onRetry}>Try again</button>}
      {ready && <p className="login-footnote">One shared collection for everyone with access.</p>}
    </main>
    <footer className="login-footer">A little care goes a long way.</footer>
  </div>;
}

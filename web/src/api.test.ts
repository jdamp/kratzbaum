import { afterEach, describe, expect, it, vi } from 'vitest';
import { finishPendingLogout, get, send, setRequestContext } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('collection cache contexts', () => {
  it('separates the same collection identity across authentication modes', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setRequestContext('no-shared', '');
    await get('/api/plants');
    setRequestContext('oidc-shared', '');
    await get('/api/plants');
    const firstHeaders = new Headers(fetchMock.mock.calls[0][1].headers);
    const secondHeaders = new Headers(fetchMock.mock.calls[1][1].headers);
    expect(firstHeaders.get('X-Kratzbaum-Cache-Context')).toBe('no-shared');
    expect(secondHeaders.get('X-Kratzbaum-Cache-Context')).toBe('oidc-shared');
    expect(firstHeaders.get('X-CSRF-Token')).toBeNull();
    expect(secondHeaders.get('X-CSRF-Token')).toBeNull();
  });

  it('purges the prior auth-mode cache when the same identity changes modes', async () => {
    const deleted: string[] = [];
    vi.stubGlobal('caches', { keys: async () => ['kratzbaum-data-no-shared', 'kratzbaum-media-no-shared', 'kratzbaum-data-oidc-shared'], delete: async (name: string) => { deleted.push(name); return true; } });
    setRequestContext('no-shared', '');
    await vi.waitFor(() => expect(deleted).toContain('kratzbaum-data-oidc-shared'));
    deleted.length = 0;
    setRequestContext('oidc-shared', '');
    await vi.waitFor(() => expect(deleted).toContain('kratzbaum-data-no-shared'));
    expect(deleted).toContain('kratzbaum-media-no-shared');
    expect(deleted).not.toContain('kratzbaum-data-oidc-shared');
  });

  it('clears cached collection reads when an online request is rejected', async () => {
    const deleted: string[] = [];
    const dispatchEvent = vi.fn();
    vi.stubGlobal('caches', { keys: async () => ['kratzbaum-data-oidc-user', 'kratzbaum-media-oidc-user'], delete: async (name: string) => { deleted.push(name); return true; } });
    vi.stubGlobal('localStorage', { removeItem: vi.fn() });
    vi.stubGlobal('window', { dispatchEvent });
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Sign-in required' }), { status: 403, headers: { 'Content-Type': 'application/json' } })));
    setRequestContext('oidc-user', '');
    await expect(get('/api/plants')).rejects.toMatchObject({ status: 403 });
    expect(deleted).toEqual(expect.arrayContaining(['kratzbaum-data-oidc-user', 'kratzbaum-media-oidc-user']));
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('rejects offline writes before sending them so no mutation can be queued', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { onLine: false });
    await expect(send('/api/plants', { name: 'Offline fern' })).rejects.toMatchObject({ status: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps a local logout pending offline and clears it only after server logout succeeds', async () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    vi.stubGlobal('localStorage', storage);
    storage.setItem('kratzbaum-local-logout', '1');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { onLine: false });
    expect(await finishPendingLogout()).toBe(false);
    expect(storage.getItem('kratzbaum-local-logout')).toBe('1');
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubGlobal('navigator', { onLine: true });
    expect(await finishPendingLogout()).toBe(true);
    expect(storage.getItem('kratzbaum-local-logout')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeWikipediaURL, resolveWikipedia, wikipediaArticleURL } from './wikipedia';

const page = (title?: string, langlinks?: Array<{lang: string; title: string}>) => ({ query: { pages: [title ? { ns: 0, title, langlinks } : { ns: 0, missing: true }] } });
function responses(...bodies: unknown[]) {
  const fetchMock = vi.fn();
  bodies.forEach(body => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
afterEach(() => vi.unstubAllGlobals());

describe('Wikipedia references', () => {
  it('normalizes manual Wikipedia destinations and preserves article fragments', () => {
    expect(normalizeWikipediaURL(' https://de.m.wikipedia.org:443/wiki/K%C3%B6stliches_Fensterblatt#Pflege ')).toBe('https://de.wikipedia.org/wiki/K%C3%B6stliches_Fensterblatt#Pflege');
    expect(normalizeWikipediaURL('https://en.wikipedia.org/wiki/Fern')).toBe('https://en.wikipedia.org/wiki/Fern');
    expect(normalizeWikipediaURL('')).toBe('');
    for (const value of ['http://de.wikipedia.org/wiki/Fern', 'javascript:alert(1)', 'https://de.wikipedia.org.evil.test/wiki/Fern', 'https://user@de.wikipedia.org/wiki/Fern', 'https://de.wikipedia.org:444/wiki/Fern', 'https://de.wikipedia.org/wiki/', 'https://de.wikipedia.org/w/index.php', 'https://de.wikipedia.org/wiki/Fern?x=1', 'https://de.wikipedia.org/wiki/Fern?', 'https://de.wikipedia.org/wiki/%0aFern']) expect(() => normalizeWikipediaURL(value), value).toThrow();
  });
  it('prefers a German article and follows its canonical redirect', async () => {
    const fetchMock = responses(page('Köstliches Fensterblatt'));
    await expect(resolveWikipedia('  Monstera \t deliciosa  ')).resolves.toEqual({ language: 'de', url: 'https://de.wikipedia.org/wiki/K%C3%B6stliches_Fensterblatt' });
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('titles')).toBe('Monstera deliciosa');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses a verified German language link when the German title differs', async () => {
    responses(page(), page('Monstera deliciosa', [{ lang: 'de', title: 'Köstliches Fensterblatt' }]), page('Köstliches Fensterblatt'));
    await expect(resolveWikipedia('Monstera deliciosa')).resolves.toEqual({ language: 'de', url: 'https://de.wikipedia.org/wiki/K%C3%B6stliches_Fensterblatt' });
  });

  it('uses English only after a successful German miss', async () => {
    responses(page(), page('Some species'), { search: [] });
    await expect(resolveWikipedia('Some species')).resolves.toEqual({ language: 'en', url: 'https://en.wikipedia.org/wiki/Some_species' });
  });

  it('finds a German-only article using an exact taxon match', async () => {
    responses(page(), page(), { search: [{ id: 'Q123' }] }, { entities: { Q123: { claims: { P225: [{ mainsnak: { datavalue: { value: 'Some species' } } }] }, sitelinks: { dewiki: { title: 'Deutscher Name' } } } } }, page('Deutscher Name'));
    await expect(resolveWikipedia('Some species')).resolves.toEqual({ language: 'de', url: 'https://de.wikipedia.org/wiki/Deutscher_Name' });
  });

  it('checks exact taxon metadata for German before falling back to English', async () => {
    responses(page(), page('Some species'), { search: [{ id: 'Q123' }] }, { entities: { Q123: { claims: { P225: [{ mainsnak: { datavalue: { value: 'Some species' } } }] }, sitelinks: { dewiki: { title: 'Deutscher Name' } } } } }, page('Deutscher Name'));
    await expect(resolveWikipedia('Some species')).resolves.toEqual({ language: 'de', url: 'https://de.wikipedia.org/wiki/Deutscher_Name' });
  });

  it('does not guess when no exact matching article exists', async () => {
    responses(page(), page(), { search: [{ id: 'Q123' }] }, { entities: { Q123: { claims: { P225: [{ mainsnak: { datavalue: { value: 'Another species' } } }] }, sitelinks: { dewiki: { title: 'Unrelated' } } } } });
    await expect(resolveWikipedia('Some species')).resolves.toBeNull();
  });

  it('treats an unavailable German lookup as a failure, not an English miss', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveWikipedia('Some species')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not query missing or structurally unsafe names', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(resolveWikipedia(' \n ')).resolves.toBeNull();
    await expect(resolveWikipedia('Name|Another')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('confines Unicode and reserved characters to an allowlisted article path', () => {
    const destination = new URL(wikipediaArticleURL('de', 'Érable / species?query=value#section'));
    expect(destination.origin).toBe('https://de.wikipedia.org');
    expect(destination.search).toBe('');
    expect(destination.hash).toBe('');
    expect(decodeURIComponent(destination.pathname.slice('/wiki/'.length))).toBe('Érable_/_species?query=value#section');
  });
});

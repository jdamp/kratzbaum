export type WikipediaLanguage = 'de' | 'en';
export type WikipediaReference = { language: WikipediaLanguage; url: string };

type Page = { title?: string; ns?: number; missing?: boolean; invalid?: boolean; langlinks?: Array<{ lang: string; title?: string }> };
type Entity = { claims?: { P225?: Array<{ mainsnak?: { datavalue?: { value?: string } } }> }; sitelinks?: Record<string, { title?: string }> };

export function wikipediaArticleURL(language: WikipediaLanguage, title: string): string {
  const normalized = title.trim().replace(/\s+/g, '_');
  return `https://${language === 'de' ? 'de' : 'en'}.wikipedia.org/wiki/${encodeURIComponent(normalized)}`;
}

function normalizedName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export async function resolveWikipedia(name: string, signal?: AbortSignal): Promise<WikipediaReference | null> {
  const scientificName = normalizedName(name);
  // These characters have structural meaning in MediaWiki title queries.
  if (!scientificName || /[|#\[\]{}<>]/.test(scientificName)) return null;

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 8000);
  const request = async (host: string, params: Record<string, string>) => {
    const url = new URL(`https://${host}/w/api.php`);
    for (const [key, value] of Object.entries({ ...params, format: 'json', formatversion: '2', origin: '*' })) url.searchParams.set(key, value);
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error('Wikipedia lookup failed');
    const data = await response.json();
    if (data.error) throw new Error('Wikipedia lookup failed');
    return data;
  };
  const page = async (language: WikipediaLanguage, title: string, languageLinks = false): Promise<Page | null> => {
    const data = await request(`${language}.wikipedia.org`, {
      action: 'query', titles: title, redirects: '1', prop: languageLinks ? 'info|langlinks' : 'info',
      ...(languageLinks ? { lllang: 'de', lllimit: '1' } : {}),
    });
    const pages = data.query?.pages;
    if (!Array.isArray(pages) || pages.length !== 1) throw new Error('Invalid Wikipedia response');
    const result = pages[0] as Page;
    return !result.missing && !result.invalid && result.ns === 0 && result.title ? result : null;
  };
  const reference = (language: WikipediaLanguage, title: string): WikipediaReference => ({ language, url: wikipediaArticleURL(language, title) });

  try {
    const german = await page('de', scientificName);
    if (german?.title) return reference('de', german.title);

    const english = await page('en', scientificName, true);
    const germanTitle = english?.langlinks?.find(link => link.lang === 'de')?.title;
    if (germanTitle) {
      const translated = await page('de', germanTitle);
      if (translated?.title) return reference('de', translated.title);
    }
    // A German article can use a vernacular title without a redirect or
    // language link. Accept a Wikidata candidate only for an exact taxon name.
    const search = await request('www.wikidata.org', { action: 'wbsearchentities', search: scientificName, language: 'en', type: 'item', limit: '5' });
    if (!Array.isArray(search.search)) throw new Error('Invalid Wikidata response');
    const ids = search.search.map((item: { id?: string }) => item.id).filter((id: unknown): id is string => typeof id === 'string' && /^Q[1-9]\d*$/.test(id)).slice(0, 5);
    if (!ids.length) return english?.title ? reference('en', english.title) : null;
    const data = await request('www.wikidata.org', { action: 'wbgetentities', ids: ids.join('|'), props: 'claims|sitelinks' });
    if (!data.entities || typeof data.entities !== 'object') throw new Error('Invalid Wikidata response');
    const englishTitles: string[] = [];
    for (const id of ids) {
      const entity = data.entities[id] as Entity | undefined;
      const matches = entity?.claims?.P225?.some(claim => normalizedName(claim.mainsnak?.datavalue?.value || '').toLocaleLowerCase('de-DE') === scientificName.toLocaleLowerCase('de-DE'));
      if (!matches) continue;
      const deTitle = entity?.sitelinks?.dewiki?.title;
      if (deTitle) {
        const match = await page('de', deTitle);
        if (match?.title) return reference('de', match.title);
      }
      const enTitle = entity?.sitelinks?.enwiki?.title;
      if (enTitle) englishTitles.push(enTitle);
    }
    let alternativeEnglish: string | undefined;
    for (const title of englishTitles) {
      const match = await page('en', title, true);
      const linkedTitle = match?.langlinks?.find(link => link.lang === 'de')?.title;
      if (linkedTitle) {
        const linked = await page('de', linkedTitle);
        if (linked?.title) return reference('de', linked.title);
      }
      alternativeEnglish ||= match?.title;
    }
    const fallback = english?.title || alternativeEnglish;
    return fallback ? reference('en', fallback) : null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

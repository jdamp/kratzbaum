export function scientificNameWikipediaURL(name: string): string | null {
  const title = name.trim().replace(/\s+/g, '_');
  return title ? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` : null;
}

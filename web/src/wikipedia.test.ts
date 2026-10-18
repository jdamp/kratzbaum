import { describe, expect, it } from 'vitest';
import { scientificNameWikipediaURL } from './wikipedia';

describe('scientific-name references', () => {
  it('normalizes surrounding and repeated whitespace into an article title', () => {
    expect(scientificNameWikipediaURL('  Monstera \t deliciosa  ')).toBe('https://en.wikipedia.org/wiki/Monstera_deliciosa');
  });
  it('omits the reference for missing names', () => {
    expect(scientificNameWikipediaURL('')).toBeNull();
    expect(scientificNameWikipediaURL(' \n\t ')).toBeNull();
  });
  it('keeps Unicode and URL delimiters within the Wikipedia title', () => {
    const name = 'Érable / species?query=value#section';
    const destination = new URL(scientificNameWikipediaURL(name)!);
    expect(destination.origin).toBe('https://en.wikipedia.org');
    expect(destination.search).toBe('');
    expect(destination.hash).toBe('');
    expect(decodeURIComponent(destination.pathname.slice('/wiki/'.length))).toBe('Érable_/_species?query=value#section');
  });
});

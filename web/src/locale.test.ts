import { describe, expect, it } from 'vitest';
import { dateKey, dateOnly, dateTimeInput, everyDays, inputToInstant, overdueDays } from './locale';

describe('German date and care formatting', () => {
  it('uses German singular and plural', () => {
    expect(everyDays(1)).toBe('Jeden Tag');
    expect(everyDays(2)).toBe('Alle 2 Tage');
    expect(overdueDays(1)).toBe('1 Tag überfällig');
    expect(overdueDays(3)).toBe('3 Tage überfällig');
  });

  it('groups instants by the deployment timezone instead of the browser timezone', () => {
    expect(dateKey('2026-03-28T23:30:00Z', 'Europe/Berlin')).toBe('2026-03-29');
    expect(dateTimeInput('2026-03-29T01:30:00Z', 'Europe/Berlin')).toBe('2026-03-29T03:30');
    expect(inputToInstant('2026-03-29T03:30', 'Europe/Berlin')).toBe('2026-03-29T01:30:00.000Z');
    expect(() => inputToInstant('2026-03-29T02:30', 'Europe/Berlin')).toThrow(/Uhrzeit/);
  });

  it('formats date-only values in German without moving the day', () => {
    expect(dateOnly('2026-03-29', { weekday: 'long', day: 'numeric', month: 'long' })).toContain('Sonntag');
    expect(dateOnly('2026-03-29', { weekday: 'long', day: 'numeric', month: 'long' })).toContain('29. März');
  });
});

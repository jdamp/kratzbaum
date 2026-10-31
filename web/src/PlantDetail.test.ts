import { describe, expect, it } from 'vitest';
import { plantCareState } from './PlantDetail';
import type { Plant, TodayResponse } from './api';

const plant = { id: 'fern', watering_interval_days: 7, summer_fertilizing_interval_days: 14, winter_fertilizing_interval_days: null } as Plant;
const snapshot = { date: '2026-10-31', timezone: 'Europe/Berlin', season: 'winter', due: [], next: [], not_started: [{ plant_id: 'fern', type: 'watering', interval_days: 7 }] } as unknown as TodayResponse;
describe('plant care summary', () => {
  it('distinguishes a missing read from a configured but unstarted schedule', () => {
    expect(plantCareState(plant, 'watering', snapshot, false, 'winter').kind).toBe('not-started');
    expect(plantCareState(plant, 'watering', snapshot, true, 'winter').kind).toBe('unavailable');
    expect(plantCareState(plant, 'watering', null, false, 'winter').kind).toBe('unavailable');
  });
  it('uses the current season without inventing deadlines for paused or missing intervals', () => {
    expect(plantCareState(plant, 'fertilizing', snapshot, false, 'winter').kind).toBe('unconfigured');
    expect(plantCareState({ ...plant, winter_fertilizing_paused: true }, 'fertilizing', null, true, 'winter').kind).toBe('paused');
    expect(plantCareState(plant, 'fertilizing', null, true, 'summer').interval).toBe(14);
  });
  it('uses the plant and care type from confirmed due/next data', () => {
    const due = { plant_name: 'Fern', plant_id: 'fern', type: 'watering' as const, due_date: '2026-10-29T00:00:00+01:00', days_overdue: 2, days_until: 0 };
    const current = { ...snapshot, due: [due] };
    expect(plantCareState(plant, 'watering', current, false, 'winter')).toMatchObject({ kind: 'overdue', label: '2 Tage überfällig' });
    expect(plantCareState(plant, 'watering', { ...current, due: [{ ...due, days_overdue: 0 }] }, false, 'winter').kind).toBe('due');
    expect(plantCareState(plant, 'watering', { ...snapshot, next: [{ ...due, days_overdue: 0, days_until: 2, due_date: '2026-11-02T00:00:00+01:00' }] }, false, 'winter')).toMatchObject({ kind: 'upcoming', label: 'Nächstes Gießen am 02.11.' });
  });
});

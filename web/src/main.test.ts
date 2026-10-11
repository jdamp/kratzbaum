import { describe, expect, it } from 'vitest';
import { activityLabels, activityStyles } from './api';

describe('activity presentation vocabulary', () => {
  it('gives every saved timeline kind a stable labelled colour class', () => {
    expect(Object.keys(activityLabels).sort()).toEqual(['fertilizing', 'note', 'photo', 'watering']);
    expect(new Set(Object.values(activityStyles)).size).toBe(4);
  });
});

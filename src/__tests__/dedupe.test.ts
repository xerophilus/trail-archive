import { describe, it, expect, beforeEach } from 'vitest';
import { dedupeActivities, saveActivities, clearAllActivities } from '../db';
import type { Activity } from '../types';

describe('Activity Deduplication', () => {
  beforeEach(async () => {
    await clearAllActivities();
  });
  
  it('dedupes by activity id', async () => {
    const existing: Activity = {
      id: '12345',
      name: 'Run 1',
      type: 'Run',
      startTime: new Date('2026-10-19T10:00:00Z'),
      distance: 5,
      duration: 1800,
      elevationGain: 50,
      locked: false
    };
    
    await saveActivities([existing]);
    
    const newActivities: Activity[] = [
      {
        id: '12345',
        name: 'Run 1 Updated',
        type: 'Run',
        startTime: new Date('2026-10-19T10:00:00Z'),
        distance: 5,
        duration: 1800,
        elevationGain: 50,
        locked: false
      },
      {
        id: '67890',
        name: 'Run 2',
        type: 'Run',
        startTime: new Date('2026-10-20T10:00:00Z'),
        distance: 10,
        duration: 3600,
        elevationGain: 100,
        locked: false
      }
    ];
    
    const toImport = await dedupeActivities(newActivities);
    
    expect(toImport).toHaveLength(1);
    expect(toImport[0].id).toBe('67890');
  });
  
  it('dedupes by start time and distance', async () => {
    const startTime = new Date('2026-10-19T10:00:00Z');
    const existing: Activity = {
      id: 'manual-123',
      name: 'Manual Run',
      type: 'Run',
      startTime,
      distance: 5.0,
      duration: 1800,
      elevationGain: 50,
      locked: false
    };
    
    await saveActivities([existing]);
    
    const newActivities: Activity[] = [
      {
        id: 'manual-456',
        name: 'Same Run',
        type: 'Run',
        startTime,
        distance: 5.0,
        duration: 1800,
        elevationGain: 50,
        locked: false
      }
    ];
    
    const toImport = await dedupeActivities(newActivities);
    
    expect(toImport).toHaveLength(0);
  });
  
  it('imports activities with different times or distances', async () => {
    const existing: Activity = {
      id: '12345',
      name: 'Run 1',
      type: 'Run',
      startTime: new Date('2026-10-19T10:00:00Z'),
      distance: 5,
      duration: 1800,
      elevationGain: 50,
      locked: false
    };
    
    await saveActivities([existing]);
    
    const newActivities: Activity[] = [
      {
        id: '67890',
        name: 'Run 2',
        type: 'Run',
        startTime: new Date('2026-10-19T10:01:00Z'),
        distance: 5,
        duration: 1800,
        elevationGain: 50,
        locked: false
      }
    ];
    
    const toImport = await dedupeActivities(newActivities);
    
    expect(toImport).toHaveLength(1);
  });
});

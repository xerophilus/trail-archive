import { describe, it, expect } from 'vitest';
import { computeRecords, computeYearlyStats } from '../records';
import type { Activity } from '../types';

describe('Records Computation', () => {
  it('finds longest run', () => {
    const activities: Activity[] = [
      {
        id: '1',
        name: 'Short Run',
        type: 'Run',
        startTime: new Date('2026-10-19T10:00:00Z'),
        distance: 5,
        duration: 1800,
        elevationGain: 50,
        locked: false
      },
      {
        id: '2',
        name: 'Long Run',
        type: 'Run',
        startTime: new Date('2026-10-20T10:00:00Z'),
        distance: 20,
        duration: 7200,
        elevationGain: 200,
        locked: false
      }
    ];
    
    const records = computeRecords(activities, true);
    const longestRun = records.find(r => r.name === 'Longest Run');
    
    expect(longestRun).toBeDefined();
    expect(longestRun!.value).toBe(20);
    expect(longestRun!.activityId).toBe('2');
  });
  
  it('finds biggest climb', () => {
    const activities: Activity[] = [
      {
        id: '1',
        name: 'Flat Run',
        type: 'Run',
        startTime: new Date('2026-10-19T10:00:00Z'),
        distance: 10,
        duration: 3600,
        elevationGain: 50,
        locked: false
      },
      {
        id: '2',
        name: 'Mountain Run',
        type: 'Trail Run',
        startTime: new Date('2026-10-20T10:00:00Z'),
        distance: 15,
        duration: 5400,
        elevationGain: 1000,
        locked: false
      }
    ];
    
    const records = computeRecords(activities, true);
    const biggestClimb = records.find(r => r.name === 'Biggest Climb');
    
    expect(biggestClimb).toBeDefined();
    expect(biggestClimb!.value).toBe(1000);
  });
  
  it('estimates best efforts from full activity distance', () => {
    const activities: Activity[] = [
      {
        id: '1',
        name: '5K Run',
        type: 'Run',
        startTime: new Date('2026-10-19T10:00:00Z'),
        distance: 5,
        duration: 1200,
        elevationGain: 0,
        locked: false
      }
    ];
    
    const records = computeRecords(activities, true);
    const fiveK = records.find(r => r.name === '5K');
    
    expect(fiveK).toBeDefined();
    expect(fiveK!.value).toBe(1200);
  });
  
  it('excludes locked activities when license invalid', () => {
    const activities: Activity[] = [
      {
        id: '1',
        name: 'Old Run',
        type: 'Run',
        startTime: new Date('2020-01-01T10:00:00Z'),
        distance: 50,
        duration: 18000,
        elevationGain: 2000,
        locked: false
      }
    ];
    
    const records = computeRecords(activities, false);
    const longestRun = records.find(r => r.name === 'Longest Run');
    
    expect(longestRun).toBeUndefined();
  });
});

describe('Yearly Stats', () => {
  it('aggregates stats by year', () => {
    const activities: Activity[] = [
      {
        id: '1',
        name: 'Run 2025-1',
        type: 'Run',
        startTime: new Date('2025-06-01T10:00:00Z'),
        distance: 10,
        duration: 3600,
        elevationGain: 100,
        locked: false
      },
      {
        id: '2',
        name: 'Run 2025-2',
        type: 'Run',
        startTime: new Date('2025-07-01T10:00:00Z'),
        distance: 15,
        duration: 5400,
        elevationGain: 150,
        locked: false
      },
      {
        id: '3',
        name: 'Run 2026-1',
        type: 'Run',
        startTime: new Date('2026-01-01T10:00:00Z'),
        distance: 20,
        duration: 7200,
        elevationGain: 200,
        locked: false
      }
    ];
    
    const yearlyStats = computeYearlyStats(activities, true);
    
    expect(yearlyStats.get(2025)).toEqual({ distance: 25, count: 2 });
    expect(yearlyStats.get(2026)).toEqual({ distance: 20, count: 1 });
  });
  
  it('excludes locked activities from stats when license invalid', () => {
    const activities: Activity[] = [
      {
        id: '1',
        name: 'Old Run',
        type: 'Run',
        startTime: new Date('2020-01-01T10:00:00Z'),
        distance: 100,
        duration: 36000,
        elevationGain: 1000,
        locked: false
      }
    ];
    
    const yearlyStats = computeYearlyStats(activities, false);
    
    expect(yearlyStats.get(2020)).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import { computeRecords, computeYearlyStats } from '../records';
import type { Activity, RoutePoint } from '../types';

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
  
  it('uses whole activity time only when distance is within 3%', () => {
    const activities: Activity[] = [
      {
        id: '1',
        name: '5K Run',
        type: 'Run',
        startTime: new Date('2026-10-19T10:00:00Z'),
        distance: 5.1,
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
  
  it('finds best effort from GPS track with fast middle segment (6:00/km with 400m at 3:00/km)', () => {
    const baseTime = new Date('2026-10-19T10:00:00Z').getTime();
    
    const route: RoutePoint[] = [];
    let lat = 0;
    let cumulativeTime = 0;
    
    const SLOW_PACE = 6 * 60;
    const FAST_PACE = 3 * 60;
    const POINT_DISTANCE = 0.02;
    
    for (let i = 0; i < 400; i++) {
      const isInFastSection = i >= 150 && i < 170;
      const pace = isInFastSection ? FAST_PACE : SLOW_PACE;
      
      if (i > 0) {
        cumulativeTime += POINT_DISTANCE * pace;
      }
      
      route.push({
        lat: lat,
        lon: 0,
        time: new Date(baseTime + cumulativeTime * 1000)
      });
      
      lat += 0.00018;
    }
    
    const slowSection5K = 4.6 * SLOW_PACE;
    const fastSection400m = 0.4 * FAST_PACE;
    const expected5K = slowSection5K + fastSection400m;
    
    const activities: Activity[] = [
      {
        id: '1',
        name: 'Variable Pace Run',
        type: 'Run',
        startTime: new Date(baseTime),
        distance: 8,
        duration: cumulativeTime,
        elevationGain: 0,
        route,
        locked: false
      }
    ];
    
    const records = computeRecords(activities, true);
    const fiveK = records.find(r => r.name === '5K');
    
    expect(fiveK).toBeDefined();
    if (fiveK) {
      expect(Math.abs(fiveK.value - expected5K)).toBeLessThan(2);
    }
  });
  
  it('best effort is never faster than brute force O(n^2) check', () => {
    const baseTime = new Date('2026-10-19T10:00:00Z').getTime();
    
    const route: RoutePoint[] = [];
    let lat = 0;
    let time = 0;
    
    for (let i = 0; i < 200; i++) {
      time += 30 + Math.random() * 20;
      route.push({
        lat: lat,
        lon: 0,
        time: new Date(baseTime + time * 1000)
      });
      lat += 0.000145;
    }
    
    const targetDistance = 1.60934;
    
    const activities: Activity[] = [
      {
        id: '1',
        name: 'Test Run',
        type: 'Run',
        startTime: new Date(baseTime),
        distance: 10,
        duration: 3600,
        elevationGain: 0,
        route,
        locked: false
      }
    ];
    
    const records = computeRecords(activities, true);
    const oneMile = records.find(r => r.name === '1 mile');
    
    let bruteForceMin: number | null = null;
    for (let i = 0; i < route.length; i++) {
      let distance = 0;
      for (let j = i + 1; j < route.length; j++) {
        const prev = route[j - 1];
        const curr = route[j];
        distance += haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
        
        if (distance >= targetDistance * 0.98 && distance <= targetDistance * 1.02) {
          const duration = (curr.time!.getTime() - route[i].time!.getTime()) / 1000;
          if (!bruteForceMin || duration < bruteForceMin) {
            bruteForceMin = duration;
          }
        }
      }
    }
    
    expect(oneMile).toBeDefined();
    if (oneMile && bruteForceMin) {
      expect(oneMile.value).toBeGreaterThanOrEqual(bruteForceMin * 0.98);
    }
  });
  
  function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  function toRad(degrees: number): number {
    return degrees * Math.PI / 180;
  }
  
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

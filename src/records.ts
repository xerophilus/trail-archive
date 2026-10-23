import type { Activity, Record, RoutePoint } from './types';

interface BestEffort {
  distance: number;
  name: string;
  unit: string;
}

const BEST_EFFORTS: BestEffort[] = [
  { distance: 1.60934, name: '1 mile', unit: 'mi' },
  { distance: 5, name: '5K', unit: 'km' },
  { distance: 10, name: '10K', unit: 'km' },
  { distance: 21.0975, name: 'Half Marathon', unit: 'km' },
  { distance: 42.195, name: 'Marathon', unit: 'km' },
  { distance: 50, name: '50K', unit: 'km' }
];

export function computeRecords(activities: Activity[]): Record[] {
  const records: Record[] = [];
  
  const runningActivities = activities.filter(a => 
    !a.locked && (a.type === 'Run' || a.type === 'Trail Run' || a.type === 'Race')
  );
  
  for (const effort of BEST_EFFORTS) {
    const best = findBestEffort(runningActivities, effort.distance);
    if (best) {
      records.push({
        name: effort.name,
        value: best.duration,
        unit: 'seconds',
        activityId: best.activityId,
        date: best.date
      });
    }
  }
  
  const longestRun = runningActivities.reduce((max, a) => 
    a.distance > (max?.distance || 0) ? a : max, null as Activity | null
  );
  
  if (longestRun) {
    records.push({
      name: 'Longest Run',
      value: longestRun.distance,
      unit: 'km',
      activityId: longestRun.id,
      date: longestRun.startTime
    });
  }
  
  const biggestClimb = runningActivities.reduce((max, a) => 
    a.elevationGain > (max?.elevationGain || 0) ? a : max, null as Activity | null
  );
  
  if (biggestClimb) {
    records.push({
      name: 'Biggest Climb',
      value: biggestClimb.elevationGain,
      unit: 'm',
      activityId: biggestClimb.id,
      date: biggestClimb.startTime
    });
  }
  
  return records;
}

interface BestEffortResult {
  duration: number;
  activityId: string;
  date: Date;
}

function findBestEffort(activities: Activity[], targetDistance: number): BestEffortResult | null {
  let best: BestEffortResult | null = null;
  
  for (const activity of activities) {
    if (activity.distance >= targetDistance && activity.duration > 0) {
      const estimatedDuration = (activity.duration / activity.distance) * targetDistance;
      
      if (!best || estimatedDuration < best.duration) {
        best = {
          duration: estimatedDuration,
          activityId: activity.id,
          date: activity.startTime
        };
      }
    }
    
    if (activity.route && activity.route.length > 10) {
      const windowEffort = findBestEffortInRoute(activity.route, targetDistance);
      if (windowEffort && (!best || windowEffort < best.duration)) {
        best = {
          duration: windowEffort,
          activityId: activity.id,
          date: activity.startTime
        };
      }
    }
  }
  
  return best;
}

function findBestEffortInRoute(route: RoutePoint[], targetDistance: number): number | null {
  if (route.length < 2) return null;
  
  let bestDuration: number | null = null;
  
  for (let i = 0; i < route.length; i++) {
    let distance = 0;
    let startTime = route[i].time;
    if (!startTime) continue;
    
    for (let j = i + 1; j < route.length; j++) {
      const prev = route[j - 1];
      const curr = route[j];
      
      distance += haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
      
      if (distance >= targetDistance * 0.95 && distance <= targetDistance * 1.05) {
        const endTime = curr.time;
        if (endTime) {
          const duration = (endTime.getTime() - startTime.getTime()) / 1000;
          if (duration > 0 && (!bestDuration || duration < bestDuration)) {
            bestDuration = duration;
          }
        }
        break;
      }
      
      if (distance > targetDistance * 1.1) break;
    }
  }
  
  return bestDuration;
}

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

export function computeYearlyStats(activities: Activity[]): Map<number, { distance: number; count: number }> {
  const yearlyStats = new Map<number, { distance: number; count: number }>();
  
  for (const activity of activities) {
    if (activity.locked) continue;
    
    const year = activity.startTime.getFullYear();
    const stats = yearlyStats.get(year) || { distance: 0, count: 0 };
    stats.distance += activity.distance;
    stats.count++;
    yearlyStats.set(year, stats);
  }
  
  return yearlyStats;
}

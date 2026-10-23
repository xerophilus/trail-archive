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

export function computeRecords(activities: Activity[], licenseValid: boolean): Record[] {
  const records: Record[] = [];
  
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  
  const runningActivities = activities.filter(a => {
    const isLocked = !licenseValid && a.startTime < twelveMonthsAgo;
    return !isLocked && (a.type === 'Run' || a.type === 'Trail Run' || a.type === 'Race');
  });
  
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
    if (activity.route && activity.route.length > 10) {
      const gpsBestEffort = findBestEffortInRoute(activity.route, targetDistance);
      if (gpsBestEffort && (!best || gpsBestEffort < best.duration)) {
        best = {
          duration: gpsBestEffort,
          activityId: activity.id,
          date: activity.startTime
        };
      }
    } else if (activity.duration > 0 && Math.abs(activity.distance - targetDistance) / targetDistance <= 0.03) {
      if (!best || activity.duration < best.duration) {
        best = {
          duration: activity.duration,
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
  
  interface CumulativePoint {
    distance: number;
    time: number;
    index: number;
  }
  
  const cumulative: CumulativePoint[] = [];
  let totalDistance = 0;
  let lastKeptIndex = -1;
  
  for (let i = 0; i < route.length; i++) {
    const point = route[i];
    if (!point.time) continue;
    
    if (lastKeptIndex >= 0) {
      const lastKept = route[lastKeptIndex];
      totalDistance += haversineDistance(lastKept.lat, lastKept.lon, point.lat, point.lon);
    }
    
    cumulative.push({
      distance: totalDistance,
      time: point.time.getTime() / 1000,
      index: i
    });
    
    lastKeptIndex = i;
  }
  
  if (cumulative.length < 2) return null;
  
  let bestDuration: number | null = null;
  let right = 1;
  
  for (let left = 0; left < cumulative.length; left++) {
    while (right < cumulative.length && cumulative[right].distance - cumulative[left].distance < targetDistance) {
      right++;
    }
    
    if (right >= cumulative.length) break;
    
    const prevSegmentDistance = cumulative[right - 1].distance - cumulative[left].distance;
    
    if (prevSegmentDistance >= targetDistance) {
      right--;
      continue;
    }
    
    const lastSegmentDistance = cumulative[right].distance - cumulative[right - 1].distance;
    if (lastSegmentDistance <= 0) continue;
    
    const f = (targetDistance - prevSegmentDistance) / lastSegmentDistance;
    const endTime = cumulative[right - 1].time + f * (cumulative[right].time - cumulative[right - 1].time);
    const duration = endTime - cumulative[left].time;
    
    if (duration > 0 && (!bestDuration || duration < bestDuration)) {
      bestDuration = duration;
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

export function computeYearlyStats(activities: Activity[], licenseValid: boolean): Map<number, { distance: number; count: number }> {
  const yearlyStats = new Map<number, { distance: number; count: number }>();
  
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  
  for (const activity of activities) {
    const isLocked = !licenseValid && activity.startTime < twelveMonthsAgo;
    if (isLocked) continue;
    
    const year = activity.startTime.getFullYear();
    const stats = yearlyStats.get(year) || { distance: 0, count: 0 };
    stats.distance += activity.distance;
    stats.count++;
    yearlyStats.set(year, stats);
  }
  
  return yearlyStats;
}

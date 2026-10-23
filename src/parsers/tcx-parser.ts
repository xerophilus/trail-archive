import type { Activity, RoutePoint } from '../types';

export function parseTCX(xmlText: string, activityId?: string): Activity | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  
  if (doc.querySelector('parsererror')) return null;
  
  const activityElement = doc.querySelector('Activity');
  if (!activityElement) return null;
  
  const type = activityElement.getAttribute('Sport') || 'Run';
  const lap = activityElement.querySelector('Lap');
  if (!lap) return null;
  
  const startTimeStr = lap.getAttribute('StartTime');
  const startTime = startTimeStr ? new Date(startTimeStr) : new Date();
  
  const totalTimeSeconds = parseFloat(lap.querySelector('TotalTimeSeconds')?.textContent || '0');
  const distanceMeters = parseFloat(lap.querySelector('DistanceMeters')?.textContent || '0');
  
  const trackpoints = Array.from(lap.querySelectorAll('Trackpoint'));
  const route: RoutePoint[] = [];
  let totalElevationGain = 0;
  let lastEle: number | null = null;
  
  for (const tp of trackpoints) {
    const position = tp.querySelector('Position');
    if (!position) continue;
    
    const lat = parseFloat(position.querySelector('LatitudeDegrees')?.textContent || '0');
    const lon = parseFloat(position.querySelector('LongitudeDegrees')?.textContent || '0');
    const ele = parseFloat(tp.querySelector('AltitudeMeters')?.textContent || '0');
    const timeStr = tp.querySelector('Time')?.textContent;
    const time = timeStr ? new Date(timeStr) : undefined;
    
    route.push({ lat, lon, ele, time });
    
    if (lastEle !== null && ele > lastEle) {
      totalElevationGain += (ele - lastEle);
    }
    lastEle = ele;
  }
  
  const name = activityElement.querySelector('Notes')?.textContent?.trim() || 'Untitled Activity';
  
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const locked = startTime < twelveMonthsAgo;
  
  const id = activityId || `tcx-${startTime.getTime()}`;
  
  return {
    id,
    name,
    type,
    startTime,
    distance: distanceMeters / 1000,
    duration: totalTimeSeconds,
    elevationGain: totalElevationGain,
    averagePace: totalTimeSeconds > 0 && distanceMeters > 0 ? totalTimeSeconds / (distanceMeters / 1000) : undefined,
    route: route.length > 0 ? route : undefined,
    locked
  };
}

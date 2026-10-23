import { XMLParser } from 'fast-xml-parser';
import type { Activity, RoutePoint, Split } from '../types';

export function parseGPX(xmlText: string, activityId?: string): Activity | null {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true
  });
  
  try {
    const doc = parser.parse(xmlText);
    
    if (!doc.gpx) return null;
    
    const trk = doc.gpx.trk;
    if (!trk) return null;
    
    const name = trk.name || 'Untitled Activity';
    const type = trk.type || 'Run';
    
    let trkpts: any[] = [];
    if (trk.trkseg) {
      const segments = Array.isArray(trk.trkseg) ? trk.trkseg : [trk.trkseg];
      for (const seg of segments) {
        if (seg.trkpt) {
          const pts = Array.isArray(seg.trkpt) ? seg.trkpt : [seg.trkpt];
          trkpts.push(...pts);
        }
      }
    }
    
    if (trkpts.length === 0) return null;
    
    const route: RoutePoint[] = [];
    let firstTime: Date | null = null;
    let lastTime: Date | null = null;
    let totalDistance = 0;
    let totalElevationGain = 0;
    let lastPoint: RoutePoint | null = null;
    
    for (const trkpt of trkpts) {
      const lat = trkpt['@_lat'] || 0;
      const lon = trkpt['@_lon'] || 0;
      const ele = trkpt.ele || 0;
      const timeStr = trkpt.time;
      const time = timeStr ? new Date(timeStr) : undefined;
      
      if (!firstTime && time) firstTime = time;
      if (time) lastTime = time;
      
      const point: RoutePoint = { lat, lon, ele, time };
      route.push(point);
      
      if (lastPoint) {
        const dist = haversineDistance(lastPoint.lat, lastPoint.lon, lat, lon);
        totalDistance += dist;
        
        if (lastPoint.ele && ele && ele > lastPoint.ele) {
          totalElevationGain += (ele - lastPoint.ele);
        }
      }
      
      lastPoint = point;
    }
    
    const duration = firstTime && lastTime ? (lastTime.getTime() - firstTime.getTime()) / 1000 : 0;
    const startTime = firstTime || new Date();
    
    const id = activityId || `gpx-${startTime.getTime()}`;
    
    return {
      id,
      name,
      type,
      startTime,
      distance: totalDistance,
      duration,
      elevationGain: totalElevationGain,
      averagePace: duration > 0 && totalDistance > 0 ? duration / totalDistance : undefined,
      route,
      locked: false
    };
  } catch (error) {
    console.error('GPX parse error:', error);
    return null;
  }
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

export function computeSplits(route: RoutePoint[], splitDistanceKm: number = 1): Split[] {
  if (route.length < 2) return [];
  
  const splits: Split[] = [];
  let splitDistance = 0;
  let splitDuration = 0;
  let splitElevationGain = 0;
  let lastPoint = route[0];
  
  for (let i = 1; i < route.length; i++) {
    const point = route[i];
    const segmentDistance = haversineDistance(lastPoint.lat, lastPoint.lon, point.lat, point.lon);
    splitDistance += segmentDistance;
    
    if (lastPoint.time && point.time) {
      splitDuration += (point.time.getTime() - lastPoint.time.getTime()) / 1000;
    }
    
    if (lastPoint.ele && point.ele && point.ele > lastPoint.ele) {
      splitElevationGain += (point.ele - lastPoint.ele);
    }
    
    if (splitDistance >= splitDistanceKm) {
      splits.push({
        distance: splitDistanceKm,
        duration: splitDuration,
        pace: splitDuration / splitDistanceKm,
        elevationGain: splitElevationGain
      });
      
      splitDistance = 0;
      splitDuration = 0;
      splitElevationGain = 0;
    }
    
    lastPoint = point;
  }
  
  if (splitDistance > 0.1) {
    splits.push({
      distance: splitDistance,
      duration: splitDuration,
      pace: splitDuration / splitDistance,
      elevationGain: splitElevationGain
    });
  }
  
  return splits;
}

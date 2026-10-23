import { XMLParser } from 'fast-xml-parser';
import type { Activity, RoutePoint } from '../types';

export function parseTCX(xmlText: string, activityId?: string): Activity | null {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true
  });
  
  try {
    const doc = parser.parse(xmlText);
    
    if (!doc.TrainingCenterDatabase) return null;
    
    const activities = doc.TrainingCenterDatabase.Activities;
    if (!activities || !activities.Activity) return null;
    
    const activityElement = activities.Activity;
    const type = activityElement['@_Sport'] || 'Run';
    
    const lap = activityElement.Lap;
    if (!lap) return null;
    
    const startTimeStr = lap['@_StartTime'];
    const startTime = startTimeStr ? new Date(startTimeStr) : new Date();
    
    const totalTimeSeconds = parseFloat(lap.TotalTimeSeconds || '0');
    const distanceMeters = parseFloat(lap.DistanceMeters || '0');
    
    const route: RoutePoint[] = [];
    let totalElevationGain = 0;
    let lastEle: number | null = null;
    
    if (lap.Track && lap.Track.Trackpoint) {
      const trackpoints = Array.isArray(lap.Track.Trackpoint) 
        ? lap.Track.Trackpoint 
        : [lap.Track.Trackpoint];
      
      for (const tp of trackpoints) {
        if (!tp.Position) continue;
        
        const lat = parseFloat(tp.Position.LatitudeDegrees || '0');
        const lon = parseFloat(tp.Position.LongitudeDegrees || '0');
        const ele = parseFloat(tp.AltitudeMeters || '0');
        const timeStr = tp.Time;
        const time = timeStr ? new Date(timeStr) : undefined;
        
        route.push({ lat, lon, ele, time });
        
        if (lastEle !== null && ele > lastEle) {
          totalElevationGain += (ele - lastEle);
        }
        lastEle = ele;
      }
    }
    
    const name = activityElement.Notes || 'Untitled Activity';
    
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
      locked: false
    };
  } catch (error) {
    console.error('TCX parse error:', error);
    return null;
  }
}

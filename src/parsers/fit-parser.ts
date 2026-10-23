import FitParser from 'fit-file-parser';
import type { Activity, RoutePoint } from '../types';

export function parseFIT(buffer: ArrayBuffer, activityId?: string): Promise<Activity | null> {
  return new Promise((resolve) => {
    const fitParser = new FitParser({
      force: true,
      speedUnit: 'km/h',
      lengthUnit: 'm',
      temperatureUnit: 'celsius',
      elapsedRecordField: true,
      mode: 'both'
    });
    
    try {
      fitParser.parse(buffer, (error: Error | undefined, data: any) => {
        if (error) {
          console.error('FIT parse error:', error);
          resolve(null);
          return;
        }
        
        try {
          const { activity, records, sessions } = data;
          
          if (!activity && !sessions?.length) {
            resolve(null);
            return;
          }
          
          const session = sessions?.[0] || activity;
          const startTime = session?.start_time ? new Date(session.start_time) : new Date();
          const totalDistance = (session?.total_distance || 0) / 1000;
          const totalTime = session?.total_elapsed_time || session?.total_timer_time || 0;
          const totalAscent = session?.total_ascent || 0;
          const sport = session?.sport || 'running';
          
          const route: RoutePoint[] = [];
          
          if (records?.length) {
            for (const record of records) {
              if (record.position_lat !== undefined && record.position_long !== undefined) {
                route.push({
                  lat: record.position_lat,
                  lon: record.position_long,
                  ele: record.altitude,
                  time: record.timestamp ? new Date(record.timestamp) : undefined
                });
              }
            }
          }
          
          const id = activityId || `fit-${startTime.getTime()}`;
          
          resolve({
            id,
            name: 'Untitled Activity',
            type: mapSportToType(sport),
            startTime,
            distance: totalDistance,
            duration: totalTime,
            elevationGain: totalAscent,
            averagePace: totalTime > 0 && totalDistance > 0 ? totalTime / totalDistance : undefined,
            route: route.length > 0 ? route : undefined,
            locked: false
          });
        } catch (err) {
          console.error('FIT data processing error:', err);
          resolve(null);
        }
      });
    } catch (error) {
      console.error('FIT parse error:', error);
      resolve(null);
    }
  });
}

function mapSportToType(sport: string): string {
  const sportMap: Record<string, string> = {
    'running': 'Run',
    'trail_running': 'Trail Run',
    'cycling': 'Ride',
    'walking': 'Walk',
    'hiking': 'Hike',
    'swimming': 'Swim'
  };
  return sportMap[sport?.toLowerCase()] || 'Run';
}

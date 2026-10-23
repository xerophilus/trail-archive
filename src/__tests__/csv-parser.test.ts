import { describe, it, expect } from 'vitest';
import { parseStravaCSV } from '../parsers/csv-parser';

describe('CSV Parser', () => {
  it('parses activities with duplicate column names', () => {
    const csv = `Activity Date,Activity Name,Activity Type,Distance,Elapsed Time,Distance,Elapsed Time,Moving Time,Elevation Gain,Activity Gear,Filename
"Oct 19, 2026, 10:06:53 AM",Morning Run,Run,7.27,3600,7270.5,3600.0,3540,125.0,Nike Pegasus 40,activities/12345.fit.gz
"Oct 18, 2026, 6:30:00 AM",Easy Run,Run,5.0,2700,5000.0,2700.0,2650,80.0,Hoka Speedgoat 5,activities/12346.gpx`;
    
    const activities = parseStravaCSV(csv);
    
    expect(activities).toHaveLength(2);
    expect(activities[0].name).toBe('Morning Run');
    expect(activities[0].distance).toBeCloseTo(7.27, 1);
    expect(activities[0].duration).toBe(3540);
    expect(activities[0].elevationGain).toBe(125);
    expect(activities[0].gear).toBe('Nike Pegasus 40');
    expect(activities[0].id).toBe('12345');
    
    expect(activities[1].name).toBe('Easy Run');
    expect(activities[1].distance).toBe(5.0);
  });
  
  it('handles activities without filename (manual entries)', () => {
    const csv = `Activity Date,Activity Name,Activity Type,Distance,Elapsed Time,Distance,Elapsed Time,Moving Time,Elevation Gain,Activity Gear,Filename
"Oct 17, 2026, 8:00:00 AM",Treadmill Run,Run,5.0,1800,5000.0,1800.0,1800,0.0,Nike Pegasus 40,`;
    
    const activities = parseStravaCSV(csv);
    
    expect(activities).toHaveLength(1);
    expect(activities[0].id).toContain('manual-');
  });
  
  it('handles multi-line descriptions in quotes', () => {
    const csv = `Activity Date,Activity Name,Activity Type,Distance,Elapsed Time,Distance,Elapsed Time,Moving Time,Elevation Gain,Activity Gear,Filename
"Oct 19, 2026, 10:06:53 AM","Morning Run
with friends
on trail",Run,7.27,3600,7270.5,3600.0,3540,125.0,Nike Pegasus 40,activities/12345.fit.gz`;
    
    const activities = parseStravaCSV(csv);
    
    expect(activities).toHaveLength(1);
    expect(activities[0].name).toContain('Morning Run');
  });
  
  it('locks activities older than 12 months', () => {
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 13);
    const dateStr = oldDate.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    });
    
    const csv = `Activity Date,Activity Name,Activity Type,Distance,Elapsed Time,Distance,Elapsed Time,Moving Time,Elevation Gain,Activity Gear,Filename
"${dateStr}",Old Run,Run,5.0,1800,5000.0,1800.0,1800,50.0,Old Shoes,activities/99999.fit.gz`;
    
    const activities = parseStravaCSV(csv);
    
    expect(activities).toHaveLength(1);
    expect(activities[0].locked).toBe(true);
  });
});

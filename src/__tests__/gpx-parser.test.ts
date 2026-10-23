import { describe, it, expect } from 'vitest';
import { parseGPX, computeSplits } from '../parsers/gpx-parser';
import type { RoutePoint } from '../types';

describe('GPX Parser', () => {
  it('parses basic GPX with route', () => {
    const gpx = `<?xml version="1.0"?>
<gpx version="1.1" creator="TestCreator">
  <trk>
    <name>Morning Run</name>
    <type>Run</type>
    <trkseg>
      <trkpt lat="37.7749" lon="-122.4194">
        <ele>10</ele>
        <time>2026-10-19T10:00:00Z</time>
      </trkpt>
      <trkpt lat="37.7750" lon="-122.4195">
        <ele>15</ele>
        <time>2026-10-19T10:05:00Z</time>
      </trkpt>
      <trkpt lat="37.7751" lon="-122.4196">
        <ele>20</ele>
        <time>2026-10-19T10:10:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;
    
    const activity = parseGPX(gpx);
    
    expect(activity).not.toBeNull();
    expect(activity!.name).toBe('Morning Run');
    expect(activity!.type).toBe('Run');
    expect(activity!.route).toHaveLength(3);
    expect(activity!.duration).toBe(600);
    expect(activity!.elevationGain).toBeGreaterThan(0);
  });
  
  it('computes splits correctly', () => {
    const route: RoutePoint[] = [
      { lat: 37.7749, lon: -122.4194, ele: 10, time: new Date('2026-10-19T10:00:00Z') },
      { lat: 37.7850, lon: -122.4194, ele: 10, time: new Date('2026-10-19T10:05:00Z') },
      { lat: 37.7950, lon: -122.4194, ele: 10, time: new Date('2026-10-19T10:10:00Z') }
    ];
    
    const splits = computeSplits(route, 1);
    
    expect(splits.length).toBeGreaterThan(0);
    splits.forEach(split => {
      expect(split.duration).toBeGreaterThan(0);
      expect(split.pace).toBeGreaterThan(0);
    });
  });
  
  it('handles GPX without time data', () => {
    const gpx = `<?xml version="1.0"?>
<gpx version="1.1">
  <trk>
    <name>Static Route</name>
    <trkseg>
      <trkpt lat="37.7749" lon="-122.4194"><ele>10</ele></trkpt>
      <trkpt lat="37.7750" lon="-122.4195"><ele>15</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;
    
    const activity = parseGPX(gpx);
    
    expect(activity).not.toBeNull();
    expect(activity!.route).toHaveLength(2);
  });
});

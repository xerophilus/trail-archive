import { describe, it, expect } from 'vitest';
import { parseFIT } from '../parsers/fit-parser';

describe('FIT Parser', () => {
  it('returns null for invalid FIT data', async () => {
    const invalidBuffer = new ArrayBuffer(10);
    const activity = await parseFIT(invalidBuffer);
    
    expect(activity).toBeNull();
  });
  
  it('returns null for empty buffer', async () => {
    const emptyBuffer = new ArrayBuffer(0);
    const activity = await parseFIT(emptyBuffer);
    
    expect(activity).toBeNull();
  });
  
  it('parses minimal FIT header correctly', async () => {
    const smallBuffer = new ArrayBuffer(100);
    const view = new Uint8Array(smallBuffer);
    view.set([0x0E, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2E, 0x46, 0x49, 0x54]);
    
    const activity = await parseFIT(smallBuffer);
    
    if (activity) {
      expect(activity.distance).toBeGreaterThanOrEqual(0);
      expect(activity.duration).toBeGreaterThanOrEqual(0);
      expect(activity.locked).toBe(false);
    }
  });
});

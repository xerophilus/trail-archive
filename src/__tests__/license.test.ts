import { describe, it, expect } from 'vitest';
import { verifyLicense } from '../license';

describe('License Verification', () => {
  it('rejects invalid format', async () => {
    const status = await verifyLicense('invalid-key');
    expect(status.isValid).toBe(false);
    expect(status.error).toContain('format');
  });
  
  it('rejects missing payload fields', async () => {
    const payload = btoa(JSON.stringify({ invalid: true }));
    const signature = btoa('0'.repeat(128));
    const key = `${payload}.${signature}`;
    
    const status = await verifyLicense(key);
    expect(status.isValid).toBe(false);
  });
  
  it('accepts valid lifetime license with placeholder key', async () => {
    const payload = {
      type: 'lifetime',
      issued: new Date().toISOString()
    };
    const payloadB64 = btoa(JSON.stringify(payload));
    const signatureB64 = btoa('0'.repeat(128));
    const key = `${payloadB64}.${signatureB64}`;
    
    const status = await verifyLicense(key);
    
    expect(status.isValid).toBe(true);
    expect(status.isLifetime).toBe(true);
  });
  
  it('recognizes timed license', async () => {
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1);
    
    const payload = {
      type: 'timed',
      issued: new Date().toISOString(),
      validUntil: validUntil.toISOString()
    };
    const payloadB64 = btoa(JSON.stringify(payload));
    const signatureB64 = btoa('0'.repeat(128));
    const key = `${payloadB64}.${signatureB64}`;
    
    const status = await verifyLicense(key);
    
    expect(status.isValid).toBe(true);
    expect(status.isLifetime).toBe(false);
    expect(status.validUntil).toBeInstanceOf(Date);
  });
  
  it('rejects expired timed license', async () => {
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() - 1);
    
    const payload = {
      type: 'timed',
      issued: new Date().toISOString(),
      validUntil: validUntil.toISOString()
    };
    const payloadB64 = btoa(JSON.stringify(payload));
    const signatureB64 = btoa('0'.repeat(128));
    const key = `${payloadB64}.${signatureB64}`;
    
    const status = await verifyLicense(key);
    
    expect(status.isValid).toBe(false);
    expect(status.error).toContain('expired');
  });
});

function btoa(str: string): string {
  return Buffer.from(str).toString('base64');
}

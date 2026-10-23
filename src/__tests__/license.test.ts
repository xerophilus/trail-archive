import { describe, it, expect } from 'vitest';
import { verifyLicense } from '../license';

describe('License Verification', () => {
  it('rejects invalid format', async () => {
    const status = await verifyLicense('invalid-key');
    expect(status.isValid).toBe(false);
    expect(status.error).toContain('format');
  });
  
  it('rejects missing payload fields', async () => {
    const payload = base64urlEncode(JSON.stringify({ invalid: true }));
    const signature = base64urlEncode('0'.repeat(64));
    const key = `${payload}.${signature}`;
    
    const status = await verifyLicense(key);
    expect(status.isValid).toBe(false);
  });
  
  it('rejects license when placeholder key is configured', async () => {
    const payload = {
      type: 'lifetime',
      issued: new Date().toISOString()
    };
    const payloadB64 = base64urlEncode(JSON.stringify(payload));
    const signatureB64 = base64urlEncode('0'.repeat(64));
    const key = `${payloadB64}.${signatureB64}`;
    
    const status = await verifyLicense(key);
    
    expect(status.isValid).toBe(false);
    expect(status.error).toContain('not configured');
  });
  
  it('rejects expired timed license', async () => {
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() - 1);
    
    const payload = {
      type: 'timed',
      issued: new Date().toISOString(),
      validUntil: validUntil.toISOString()
    };
    const payloadB64 = base64urlEncode(JSON.stringify(payload));
    const signatureB64 = base64urlEncode('0'.repeat(64));
    const key = `${payloadB64}.${signatureB64}`;
    
    const status = await verifyLicense(key);
    
    expect(status.isValid).toBe(false);
    expect(status.error).toContain('expired');
  });
});

function base64urlEncode(str: string): string {
  const bytes = Buffer.from(str);
  return bytes.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

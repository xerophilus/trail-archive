import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;

describe('License Round-trip Verification', () => {
  it('generates keypair, signs, and verifies successfully', async () => {
    const keyPair = await subtle.generateKey(
      { name: 'Ed25519' },
      true,
      ['sign', 'verify']
    ) as CryptoKeyPair;
    
    const publicKeySpki = await subtle.exportKey('spki', keyPair.publicKey);
    
    const payload = {
      type: 'lifetime',
      issued: new Date().toISOString()
    };
    
    const payloadB64 = base64urlEncode(JSON.stringify(payload));
    const payloadBytes = new TextEncoder().encode(payloadB64);
    
    const signature = await subtle.sign('Ed25519', keyPair.privateKey, payloadBytes);
    const signatureB64 = base64urlEncode(new Uint8Array(signature));
    
    const licenseKey = `${payloadB64}.${signatureB64}`;
    
    const isValid = await verifyLicenseWithKey(licenseKey, publicKeySpki);
    
    expect(isValid).toBe(true);
  });
  
  it('rejects tampered license key', async () => {
    const keyPair = await subtle.generateKey(
      { name: 'Ed25519' },
      true,
      ['sign', 'verify']
    ) as CryptoKeyPair;
    
    const publicKeySpki = await subtle.exportKey('spki', keyPair.publicKey);
    
    const payload = {
      type: 'lifetime',
      issued: new Date().toISOString()
    };
    
    const payloadB64 = base64urlEncode(JSON.stringify(payload));
    const payloadBytes = new TextEncoder().encode(payloadB64);
    
    const signature = await subtle.sign('Ed25519', keyPair.privateKey, payloadBytes);
    const signatureB64 = base64urlEncode(new Uint8Array(signature));
    
    const tamperedPayload = {
      type: 'lifetime',
      issued: new Date(Date.now() + 86400000).toISOString()
    };
    const tamperedPayloadB64 = base64urlEncode(JSON.stringify(tamperedPayload));
    
    const tamperedLicenseKey = `${tamperedPayloadB64}.${signatureB64}`;
    
    const isValid = await verifyLicenseWithKey(tamperedLicenseKey, publicKeySpki);
    
    expect(isValid).toBe(false);
  });
  
  it('rejects license signed with different key', async () => {
    const keyPair1 = await subtle.generateKey(
      { name: 'Ed25519' },
      true,
      ['sign', 'verify']
    ) as CryptoKeyPair;
    
    const keyPair2 = await subtle.generateKey(
      { name: 'Ed25519' },
      true,
      ['sign', 'verify']
    ) as CryptoKeyPair;
    
    const publicKeySpki2 = await subtle.exportKey('spki', keyPair2.publicKey);
    
    const payload = {
      type: 'lifetime',
      issued: new Date().toISOString()
    };
    
    const payloadB64 = base64urlEncode(JSON.stringify(payload));
    const payloadBytes = new TextEncoder().encode(payloadB64);
    
    const signature = await subtle.sign('Ed25519', keyPair1.privateKey, payloadBytes);
    const signatureB64 = base64urlEncode(new Uint8Array(signature));
    
    const licenseKey = `${payloadB64}.${signatureB64}`;
    
    const isValid = await verifyLicenseWithKey(licenseKey, publicKeySpki2);
    
    expect(isValid).toBe(false);
  });
});

async function verifyLicenseWithKey(licenseKey: string, publicKeySpki: ArrayBuffer): Promise<boolean> {
  try {
    const parts = licenseKey.split('.');
    if (parts.length !== 2) return false;
    
    const [payloadB64, signatureB64] = parts;
    const signatureBytes = base64urlDecodeToBytes(signatureB64);
    const payloadBytes = new TextEncoder().encode(payloadB64);
    
    const publicKey = await subtle.importKey(
      'spki',
      publicKeySpki,
      { name: 'Ed25519' },
      false,
      ['verify']
    );
    
    const signatureBuffer = signatureBytes.buffer.slice(
      signatureBytes.byteOffset,
      signatureBytes.byteOffset + signatureBytes.byteLength
    ) as ArrayBuffer;
    
    const payloadBuffer = payloadBytes.buffer.slice(
      payloadBytes.byteOffset,
      payloadBytes.byteOffset + payloadBytes.byteLength
    ) as ArrayBuffer;
    
    return await subtle.verify('Ed25519', publicKey, signatureBuffer, payloadBuffer);
  } catch {
    return false;
  }
}

function base64urlEncode(data: string | Uint8Array): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlDecodeToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function btoa(str: string): string {
  return Buffer.from(str, 'binary').toString('base64');
}

function atob(str: string): string {
  return Buffer.from(str, 'base64').toString('binary');
}

#!/usr/bin/env node
import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;

const PRIVATE_KEY_HEX = process.env.PRIVATE_KEY_HEX;

if (!PRIVATE_KEY_HEX) {
  console.error('Error: PRIVATE_KEY_HEX environment variable not set');
  console.error('Usage: PRIVATE_KEY_HEX=<hex> node scripts/sign-license.mjs [lifetime|365]');
  process.exit(1);
}

const licenseType = process.argv[2] || 'lifetime';

async function signLicense(type) {
  const payload = {
    type: type === 'lifetime' ? 'lifetime' : 'timed',
    issued: new Date().toISOString(),
    validUntil: type === 'lifetime' ? undefined : new Date(Date.now() + parseInt(type) * 24 * 60 * 60 * 1000).toISOString()
  };
  
  const payloadB64 = btoa(JSON.stringify(payload));
  const payloadBytes = new TextEncoder().encode(payloadB64);
  
  const privateKeyBytes = hexToBytes(PRIVATE_KEY_HEX);
  const privateKey = await subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    {
      name: 'Ed25519'
    },
    false,
    ['sign']
  );
  
  const signature = await subtle.sign('Ed25519', privateKey, payloadBytes);
  const signatureB64 = btoa(bytesToHex(new Uint8Array(signature)));
  
  const licenseKey = `${payloadB64}.${signatureB64}`;
  
  console.log('=== License Key ===\n');
  console.log(licenseKey);
  console.log('\nPayload:');
  console.log(JSON.stringify(payload, null, 2));
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function btoa(str) {
  return Buffer.from(str).toString('base64');
}

signLicense(licenseType).catch(console.error);

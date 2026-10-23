export const PUBLIC_KEY_SPKI_HEX = 'PLACEHOLDER_PUBLIC_KEY_SPKI_HEX_REPLACE_WITH_REAL_KEY';
export const BUY_URL = 'https://example.com/buy';

const LICENSE_KEY_STORAGE = 'trail-archive-license';

export interface LicenseStatus {
  isValid: boolean;
  isLifetime: boolean;
  validUntil?: Date;
  error?: string;
}

export async function verifyLicense(licenseKey: string): Promise<LicenseStatus> {
  try {
    const parts = licenseKey.split('.');
    if (parts.length !== 2) {
      return { isValid: false, isLifetime: false, error: 'Invalid license format' };
    }
    
    const [payloadB64, signatureB64] = parts;
    const payload = JSON.parse(base64urlDecode(payloadB64));
    
    if (!payload.type || !payload.issued) {
      return { isValid: false, isLifetime: false, error: 'Invalid license payload' };
    }
    
    const isLifetime = payload.type === 'lifetime';
    const validUntil = payload.validUntil ? new Date(payload.validUntil) : undefined;
    
    if (validUntil && validUntil < new Date()) {
      return { isValid: false, isLifetime: false, error: 'License expired' };
    }
    
    if (PUBLIC_KEY_SPKI_HEX === 'PLACEHOLDER_PUBLIC_KEY_SPKI_HEX_REPLACE_WITH_REAL_KEY') {
      return { isValid: false, isLifetime: false, error: 'Public key not configured' };
    }
    
    const signatureBytes = base64urlDecodeToBytes(signatureB64);
    const payloadBytes = new TextEncoder().encode(payloadB64);
    
    const publicKeyBytes = hexToBytes(PUBLIC_KEY_SPKI_HEX);
    
    const publicKeyBuffer = publicKeyBytes.buffer.slice(
      publicKeyBytes.byteOffset,
      publicKeyBytes.byteOffset + publicKeyBytes.byteLength
    ) as ArrayBuffer;
    
    const publicKey = await crypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      {
        name: 'Ed25519'
      },
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
    
    const isValid = await crypto.subtle.verify(
      'Ed25519',
      publicKey,
      signatureBuffer,
      payloadBuffer
    );
    
    if (!isValid) {
      return { isValid: false, isLifetime: false, error: 'Invalid signature' };
    }
    
    return { isValid: true, isLifetime, validUntil };
  } catch (error) {
    console.error('License verification error:', error);
    return { isValid: false, isLifetime: false, error: 'Verification failed' };
  }
}

export function saveLicense(licenseKey: string): void {
  localStorage.setItem(LICENSE_KEY_STORAGE, licenseKey);
}

export function loadLicense(): string | null {
  return localStorage.getItem(LICENSE_KEY_STORAGE);
}

export function clearLicense(): void {
  localStorage.removeItem(LICENSE_KEY_STORAGE);
}

export async function checkLicenseStatus(): Promise<LicenseStatus> {
  const licenseKey = loadLicense();
  if (!licenseKey) {
    return { isValid: false, isLifetime: false };
  }
  return verifyLicense(licenseKey);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function base64urlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return atob(base64 + pad);
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

#!/usr/bin/env node
import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;

async function generateKeyPair() {
  const keyPair = await subtle.generateKey(
    {
      name: 'Ed25519'
    },
    true,
    ['sign', 'verify']
  );
  
  const publicKeySpki = await subtle.exportKey('spki', keyPair.publicKey);
  const privateKeyPkcs8 = await subtle.exportKey('pkcs8', keyPair.privateKey);
  
  const publicKeyHex = Buffer.from(publicKeySpki).toString('hex');
  const privateKeyHex = Buffer.from(privateKeyPkcs8).toString('hex');
  
  console.log('=== Trail Archive License Keys ===\n');
  console.log('Public Key (SPKI hex):');
  console.log(publicKeyHex);
  console.log('\nPrivate Key (PKCS#8 hex):');
  console.log(privateKeyHex);
  console.log('\n⚠️  NEVER commit the private key to git!');
  console.log('Store it securely and use it only for signing licenses.');
  console.log('\nReplace PUBLIC_KEY_SPKI_HEX in src/license.ts with the public key above.');
}

generateKeyPair().catch(console.error);

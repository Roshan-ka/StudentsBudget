// Makes the HTTPS certificate for `npm run start:https` with mkcert, for localhost and every address of this PC.
// It never runs `mkcert -install`: that changes the system trust store, so it is a step you do yourself.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { certHosts, certPaths, privateIPv4s } from './https-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { cert, key } = certPaths(process.env, root);

// Asking where the root CA lives doubles as the check that mkcert is installed.
const caRoot = spawnSync('mkcert', ['-CAROOT'], { encoding: 'utf8' });
if (caRoot.error) {
  console.error('mkcert was not found on your PATH. Install it once, then open a new terminal:');
  console.error('  winget install FiloSottile.mkcert');
  console.error('Then run mkcert -install, and npm run cert:https again.');
  process.exit(1);
}

mkdirSync(path.dirname(cert), { recursive: true });
mkdirSync(path.dirname(key), { recursive: true });

const hosts = certHosts(privateIPv4s(os.networkInterfaces()), os.hostname());
console.log(`Making a certificate for: ${hosts.join(', ')}`);
const made = spawnSync('mkcert', ['-cert-file', cert, '-key-file', key, ...hosts], { stdio: 'inherit' });
if (made.status !== 0) process.exit(made.status ?? 1);

console.log('');
console.log(`Certificate: ${cert}`);
console.log(`Key:         ${key}`);
console.log('');
console.log('For the iPhone, send this file to the phone and install it as a profile (README, "Try it on your iPhone"):');
console.log(`  ${path.join(caRoot.stdout.trim(), 'rootCA.pem')}`);
console.log('Keep rootCA-key.pem in that folder private: whoever has it can make certificates your phone trusts.');
console.log('If you did not run mkcert -install on this PC yet, do that once too.');
console.log('');
console.log('Then run: npm run start:https');

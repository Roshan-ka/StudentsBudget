// Serves the production build over HTTPS, so a phone on the same Wi-Fi can open it in a secure context.
// Service workers and crypto.randomUUID only exist there; a plain-HTTP address such as http://192.168.0.5:3100 has neither.
// `npm run start:https` builds first and then runs this. The certificate comes from `npm run cert:https` (mkcert).
import { existsSync, readFileSync } from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import next from 'next';
import { certPaths, httpsPort, phoneUrls, privateIPv4s } from './https-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let port;
try {
  port = httpsPort(process.env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const { cert, key } = certPaths(process.env, root);
const missing = [cert, key].filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error(`No HTTPS certificate yet. Missing:\n${missing.map((file) => `  ${file}`).join('\n')}\n`);
  console.error('Make one once, on this PC:');
  console.error('  1. Install mkcert:   winget install FiloSottile.mkcert');
  console.error('  2. Trust its root:   mkcert -install');
  console.error('  3. Make the files:   npm run cert:https');
  console.error('\nThen run npm run start:https again. The README section "Try it on your iPhone" has the phone steps.');
  process.exit(1);
}

const app = next({ dev: false, dir: root, hostname: '0.0.0.0', port });
const handle = app.getRequestHandler();
await app.prepare();

const server = https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (req, res) => {
  handle(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) res.statusCode = 500;
    res.end();
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Pick another one with HTTPS_PORT, for example HTTPS_PORT=3444.`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`StudentsBudget is running over HTTPS. On the iPhone, open one of these in Safari:`);
  for (const url of phoneUrls(privateIPv4s(os.networkInterfaces()), os.hostname(), port)) console.log(`  ${url}`);
  console.log(`On this PC: https://localhost:${port}`);
  console.log('');
  console.log('The phone has to trust the mkcert root certificate first. The README has the steps:');
  console.log('"Try it on your iPhone (HTTPS on your own Wi-Fi)".');
});

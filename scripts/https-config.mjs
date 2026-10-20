// Pure helpers for scripts/start-https.mjs and scripts/make-cert.mjs. Nothing here touches the disk or the network,
// so the unit tests can run them with made-up input.
import path from 'node:path';

const DEFAULT_PORT = 3443;

/** True for 10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16. */
function isPrivateIPv4(address) {
  const [a, b] = address.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/**
 * The private IPv4 addresses of this PC, in the order the interfaces list them, each once.
 * Takes what `os.networkInterfaces()` returns. Internal interfaces (loopback) are skipped.
 */
export function privateIPv4s(networkInterfaces) {
  const found = [];
  for (const addresses of Object.values(networkInterfaces)) {
    for (const entry of addresses ?? []) {
      // Node 24 says 'IPv4'; some older versions said 4.
      const isIPv4 = entry.family === 'IPv4' || entry.family === 4;
      if (isIPv4 && !entry.internal && isPrivateIPv4(entry.address) && !found.includes(entry.address)) {
        found.push(entry.address);
      }
    }
  }
  return found;
}

/** The mDNS name an iPhone can find this PC under: the first label of the hostname, plus `.local`. */
function localName(hostname) {
  return `${hostname.split('.')[0]}.local`;
}

/** Every address the phone can open: `https://<ip>:<port>` for each IP, then `https://<hostname>.local:<port>`. */
export function phoneUrls(ips, hostname, port) {
  return [...ips.map((ip) => `https://${ip}:${port}`), `https://${localName(hostname)}:${port}`];
}

/**
 * Where the certificate and its key are. `certs/studentsbudget.pem` and `certs/studentsbudget-key.pem` under `cwd`,
 * unless `HTTPS_CERT` / `HTTPS_KEY` say otherwise (a relative path is taken from `cwd`).
 */
export function certPaths(env, cwd) {
  return {
    cert: path.resolve(cwd, env.HTTPS_CERT || path.join('certs', 'studentsbudget.pem')),
    key: path.resolve(cwd, env.HTTPS_KEY || path.join('certs', 'studentsbudget-key.pem')),
  };
}

/** The names and addresses the certificate has to cover: this PC as the phone and the PC's own browser see it. */
export function certHosts(ips, hostname) {
  return ['localhost', '127.0.0.1', ...ips, localName(hostname)];
}

/** The port to serve on: `HTTPS_PORT`, or 3443. The default is not 3000, which `next dev` uses (see CLAUDE.md, Service worker). */
export function httpsPort(env) {
  if (!env.HTTPS_PORT) return DEFAULT_PORT;
  const port = Number(env.HTTPS_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError(`HTTPS_PORT must be a port number between 1 and 65535, not "${env.HTTPS_PORT}".`);
  }
  return port;
}

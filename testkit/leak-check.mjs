// The leak check (testkit/README.md, "Leak check"): before a config that types real credentials runs for real, a run
// of it with throwaway ones, failing on purpose at its end, must print and keep none of them. This module finds them:
// the secrets as given, and every authenticator code they could have produced while the run lasted. GitHub's masking
// isn't relied on. Pure functions, apart from reading the files a run left.

import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const STEP = 30_000;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** The bytes of a base32 authenticator key (spaces, dashes and padding ignored, any case). */
export function base32Bytes(key) {
  const clean = key.toUpperCase().replace(/[\s=-]/g, '');
  let bits = '';
  for (const char of clean) {
    const value = BASE32.indexOf(char);
    if (value === -1) throw new Error('an authenticator key has only the letters A-Z and the digits 2-7');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** The 6-digit code (RFC 6238: SHA-1, 30 s) a key gives at a time, computed here, apart from the code under test. */
export function totp(key, time = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / STEP)));
  const hash = createHmac('sha1', base32Bytes(key)).update(counter).digest();
  const offset = hash[hash.length - 1] & 0xf;
  const value = (hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, '0');
}

/** Every code a key gave from `from` to `to`, with one window of margin on each side, oldest first. */
export function codesBetween(key, from, to) {
  const codes = [];
  for (let step = Math.floor(from / STEP) - 1; step <= Math.floor(to / STEP) + 1; step += 1) codes.push(totp(key, step * STEP));
  return [...new Set(codes)];
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A pattern for one secret: a code only where no digit is next to it, so a longer number holding it isn't a find. */
function patternFor({ value, digits }) {
  return new RegExp(digits ? `(?<!\\d)${escape(value)}(?!\\d)` : escape(value), 'g');
}

/**
 * Where each secret appears in each text. `secrets` are `{ name, value, digits? }` (`digits` for a code), `texts`
 * are `{ where, text }`. A line that starts with `::add-mask::` doesn't count: the runner takes it and never shows it.
 * Returns one `{ where, line, name }` per find, the line numbered from 1.
 */
export function findLeaks(texts, secrets) {
  const finds = [];
  const wanted = secrets.filter((secret) => secret.value);
  for (const { where, text } of texts) {
    text.split(/\r?\n/).forEach((line, index) => {
      if (line.trimStart().startsWith('::add-mask::')) return;
      for (const secret of wanted) {
        if (patternFor(secret).test(line)) finds.push({ where, line: index + 1, name: secret.name });
      }
    });
  }
  return finds;
}

/** The text with every secret replaced by `[leak: <name>]`, safe to print. */
export function redact(text, secrets) {
  return secrets.filter((secret) => secret.value).reduce((out, secret) => out.replace(patternFor(secret), `[leak: ${secret.name}]`), text);
}

/** Every file under a folder (none when it doesn't exist), as paths. */
export function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/** The files among `files` that are recordings: a trace, a screenshot or a video. A run with real credentials keeps none. */
export const recordings = (files) => files.filter((file) => /\.(zip|png|jpe?g|webm|mp4)$/i.test(file) || /(^|[\\/])trace/i.test(path.basename(file)));

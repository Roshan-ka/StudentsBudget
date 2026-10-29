import { createHmac } from 'node:crypto';

// The code an authenticator app shows (RFC 6238: SHA-1, 30-second steps, 6 digits), so the contract test can play the
// user's phone. Tests only: nothing in the app imports it.

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;

/** The bytes of a base32 secret (RFC 4648), as GoTrue hands it out: upper case, with no padding. */
export function base32Bytes(secret: string): Buffer {
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of secret.replace(/=+$/, '').toUpperCase()) {
    const digit = BASE32.indexOf(char);
    if (digit === -1) throw new Error(`Not a base32 secret: "${char}" isn't a base32 digit.`);
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

/** The 6-digit code for `secret` at `time` (milliseconds since 1970), as an authenticator app shows it then. */
export function totpCode(secret: string, time: number = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / STEP_SECONDS)));
  const mac = createHmac('sha1', base32Bytes(secret)).update(counter).digest();
  // Dynamic truncation: the last nibble picks four bytes, read without their top bit.
  const offset = mac[mac.length - 1] & 0x0f;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

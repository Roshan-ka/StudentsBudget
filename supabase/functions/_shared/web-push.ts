// Web Push for the weekly reminder (docs/superpowers/plans/2026-11-05-weekly-reminder.md, chunk 3): a message encrypted
// for one phone as RFC 8291 says (aes128gcm) and signed for its push service with VAPID (RFC 8292). Web Crypto only, no
// library: the `weekly-reminder` Edge Function (Deno) and the app's tests (Vitest, on Node) run the same code, and the
// tests hold it to the RFC's own example.

/**
 * The push services browsers use: Google's FCM, Apple, Mozilla and Microsoft. The table's check
 * (20261105144946_push_subscriptions.sql) says the same, and a test compares the two.
 */
export const PUSH_ENDPOINT =
  /^https:\/\/(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)\//;

/** One phone's push address and keys, as `PushSubscription.toJSON()` gives them (base64url). */
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** The server's VAPID keys as `web-push generate-vapid-keys` prints them (base64url), and its contact (`mailto:`). */
export type VapidKeys = { publicKey: string; privateKey: string; subject: string };

/** How the push service treats the message (RFC 8030): how long it keeps it, and which waiting message it replaces. */
export type PushOptions = { ttlSeconds: number; topic?: string; urgency?: 'very-low' | 'low' | 'normal' | 'high' };

type Bytes = Uint8Array<ArrayBuffer>;

/** One record holds the whole message: the reminder is a short line. */
const RECORD_SIZE = 4096;
/** The 16-byte tag AES-GCM adds. */
const TAG_LENGTH = 16;
/** How long a VAPID signature is good for: at most 24 hours (RFC 8292). */
const VAPID_HOURS = 12;

const encoder = new TextEncoder();

export function fromBase64Url(text: string): Bytes {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Bytes {
  const all = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    all.set(part, at);
    at += part.length;
  }
  return all;
}

/** A P-256 public key as the uncompressed point (65 bytes, starting 0x04), or an error. */
function publicPoint(key: string, what: string): Bytes {
  const point = fromBase64Url(key);
  if (point.length !== 65 || point[0] !== 4) throw new Error(`${what} is not a P-256 public key`);
  return point;
}

/** A private key in Web Crypto from its raw form: the 32-byte scalar with its 65-byte public point. */
function privateKey(publicKey: Bytes, scalar: string, algorithm: 'ECDH' | 'ECDSA'): Promise<CryptoKey> {
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: toBase64Url(publicKey.slice(1, 33)),
    y: toBase64Url(publicKey.slice(33, 65)),
    d: scalar,
  };
  return crypto.subtle.importKey('jwk', jwk, { name: algorithm, namedCurve: 'P-256' }, false, [
    algorithm === 'ECDH' ? 'deriveBits' : 'sign',
  ]);
}

/** HKDF-SHA-256, extract and expand in one (RFC 5869). */
async function hkdf(salt: Bytes, secret: Bytes, info: Bytes, length: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/**
 * The message encrypted for one phone (RFC 8291, aes128gcm): the header (salt, record size, the server's one-time
 * public key) and one record. A new key pair and salt each time; `fixed` sets them, for the RFC's example only.
 */
export async function encryptMessage(
  plaintext: Uint8Array,
  target: Pick<PushTarget, 'p256dh' | 'auth'>,
  fixed?: { publicKey: string; privateKey: string; salt: string },
): Promise<Bytes> {
  const phoneKey = publicPoint(target.p256dh, 'p256dh');
  const authSecret = fromBase64Url(target.auth);
  if (authSecret.length !== 16) throw new Error('auth is not 16 bytes');
  if (plaintext.length + 1 + TAG_LENGTH > RECORD_SIZE) throw new Error('The message is too long for one record');

  let serverPublic: Bytes;
  let serverPrivate: CryptoKey;
  if (fixed) {
    serverPublic = publicPoint(fixed.publicKey, 'The fixed public key');
    serverPrivate = await privateKey(serverPublic, fixed.privateKey, 'ECDH');
  } else {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    serverPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
    serverPrivate = pair.privateKey;
  }
  const salt = fixed ? fromBase64Url(fixed.salt) : crypto.getRandomValues(new Uint8Array(16));

  const phonePublic = await crypto.subtle.importKey('raw', phoneKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: phonePublic }, serverPrivate, 256));
  const keyInfo = concat(encoder.encode('WebPush: info\0'), phoneKey, serverPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);
  const contentKey = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);

  // The one and last record: the text, then the delimiter 0x02 and no padding.
  const aes = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
  const record = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(plaintext, Uint8Array.of(2))),
  );

  const header = new Uint8Array(16 + 4 + 1 + serverPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = serverPublic.length;
  header.set(serverPublic, 21);
  return concat(header, record);
}

/**
 * The `Authorization` header that tells the push service who sends (RFC 8292): a JWT for the endpoint's origin, signed
 * ES256 with the VAPID private key, and the public key the phone subscribed with.
 */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, now: Date): Promise<string> {
  const json = (value: object) => toBase64Url(encoder.encode(JSON.stringify(value)));
  const claims = {
    aud: new URL(endpoint).origin,
    exp: Math.floor(now.getTime() / 1000) + VAPID_HOURS * 60 * 60,
    sub: vapid.subject,
  };
  const unsigned = `${json({ typ: 'JWT', alg: 'ES256' })}.${json(claims)}`;
  const key = await privateKey(publicPoint(vapid.publicKey, 'The VAPID public key'), vapid.privateKey, 'ECDSA');
  // Web Crypto signs as r || s (64 bytes), the form JWS wants.
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned));
  return `vapid t=${unsigned}.${toBase64Url(new Uint8Array(signature))}, k=${vapid.publicKey}`;
}

/**
 * Sends `text` to one phone through its push service, and resolves the service's status: 201 when it took the message,
 * 404 or 410 when the address is gone for good. Refuses an address that isn't a known push service's.
 */
export async function sendPush(
  target: PushTarget,
  text: string,
  vapid: VapidKeys,
  options: PushOptions,
  now: Date,
  fetcher: typeof fetch = fetch,
): Promise<number> {
  if (!PUSH_ENDPOINT.test(target.endpoint)) throw new Error('Not a known push service');
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(target.endpoint, vapid, now),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(options.ttlSeconds),
    Urgency: options.urgency ?? 'normal',
  };
  if (options.topic) headers.Topic = options.topic;
  const body = await encryptMessage(encoder.encode(text), target);
  const response = await fetcher(target.endpoint, { method: 'POST', headers, body });
  // Nothing in the answer is used; reading it lets the connection go.
  await response.body?.cancel();
  return response.status;
}

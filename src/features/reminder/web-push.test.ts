import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  encryptMessage,
  fromBase64Url,
  PUSH_ENDPOINT,
  sendPush,
  toBase64Url,
  vapidAuthorization,
  type VapidKeys,
} from '../../../supabase/functions/_shared/web-push';

// The weekly reminder's Web Push (chunk 3): RFC 8291's encryption, checked against the RFC's own example, and RFC 8292's
// VAPID header, checked by verifying its signature. The sender (supabase/functions/weekly-reminder) runs this code.

const encoder = new TextEncoder();

// RFC 8291, section 5 and appendix A.
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  phonePublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  serverPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  serverPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml' +
    'mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT' +
    'pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

/** A phone's subscription keys, with the private key the test decrypts with. */
async function phone() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const p256dh = toBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
  const auth = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  return { p256dh, auth, privateKey: pair.privateKey };
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, secret: Uint8Array<ArrayBuffer>, info: string | Uint8Array<ArrayBuffer>, length: number) {
  const key = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
  const bytes = typeof info === 'string' ? encoder.encode(info) : info;
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: bytes }, key, length * 8));
}

/** Decrypts a message as the phone's browser does (RFC 8291, the receiver's side), written apart from the sender's code. */
async function decrypt(body: Uint8Array<ArrayBuffer>, keys: { p256dh: string; auth: string; privateKey: CryptoKey }) {
  const salt = body.slice(0, 16);
  const recordSize = new DataView(body.buffer, body.byteOffset).getUint32(16);
  const idLength = body[20];
  const serverPublic = body.slice(21, 21 + idLength);
  const record = body.slice(21 + idLength);
  const server = await crypto.subtle.importKey('raw', serverPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: server }, keys.privateKey, 256));
  const phonePublic = fromBase64Url(keys.p256dh);
  const info = new Uint8Array([...encoder.encode('WebPush: info\0'), ...phonePublic, ...serverPublic]);
  const ikm = await hkdf(fromBase64Url(keys.auth), shared, info, 32);
  const key = await crypto.subtle.importKey('raw', await hkdf(salt, ikm, 'Content-Encoding: aes128gcm\0', 16), 'AES-GCM', false, ['decrypt']);
  const nonce = await hkdf(salt, ikm, 'Content-Encoding: nonce\0', 12);
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, record));
  return { recordSize, idLength, delimiter: padded[padded.length - 1], text: new TextDecoder().decode(padded.slice(0, -1)) };
}

/** A VAPID key pair as `web-push generate-vapid-keys` prints it, with the key the test verifies with. */
async function vapidKeys(): Promise<VapidKeys & { verifyKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = toBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey, privateKey: jwk.d ?? '', subject: 'mailto:reminder@example.com', verifyKey: pair.publicKey };
}

const NOW = new Date('2026-11-08T17:00:00Z');
const FCM = 'https://fcm.googleapis.com/fcm/send/abc:def';

describe('encryptMessage (RFC 8291)', () => {
  it('gives the RFC’s example byte for byte', async () => {
    const body = await encryptMessage(
      encoder.encode(RFC.plaintext),
      { p256dh: RFC.phonePublic, auth: RFC.auth },
      { publicKey: RFC.serverPublic, privateKey: RFC.serverPrivate, salt: RFC.salt },
    );
    // 86 bytes of header, 41 of text, the delimiter and the 16-byte tag. (The RFC's request says Content-Length: 145,
    // but its own body is 144 bytes.)
    expect(body.length).toBe(144);
    expect(toBase64Url(body)).toBe(RFC.body);
  });

  it('is read by the phone it is for, with a new key and salt each time', async () => {
    const keys = await phone();
    const text = JSON.stringify({ title: 'StudentsBudget', body: 'Zeit für deinen wöchentlichen Check-in.' });
    const first = await encryptMessage(encoder.encode(text), keys);
    const second = await encryptMessage(encoder.encode(text), keys);

    expect(await decrypt(first, keys)).toEqual({ recordSize: 4096, idLength: 65, delimiter: 2, text });
    expect(toBase64Url(first.slice(0, 16))).not.toBe(toBase64Url(second.slice(0, 16)));
    expect(toBase64Url(first.slice(21, 86))).not.toBe(toBase64Url(second.slice(21, 86)));
  });

  it('refuses keys that are not a phone’s, and a message too long for one record', async () => {
    const keys = await phone();
    await expect(encryptMessage(encoder.encode('x'), { ...keys, p256dh: keys.auth })).rejects.toThrow('p256dh');
    await expect(encryptMessage(encoder.encode('x'), { ...keys, auth: keys.p256dh })).rejects.toThrow('auth');
    await expect(encryptMessage(new Uint8Array(4080), keys)).rejects.toThrow('too long');
  });
});

describe('vapidAuthorization (RFC 8292)', () => {
  it('signs a JWT for the push service’s origin, good for 12 hours, with the public key beside it', async () => {
    const vapid = await vapidKeys();
    const header = await vapidAuthorization(FCM, vapid, NOW);
    const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header);
    expect(match).not.toBeNull();
    const [, head, claims, signature, k] = match ?? [];

    const json = (part: string) => JSON.parse(new TextDecoder().decode(fromBase64Url(part)));
    expect(json(head)).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(json(claims)).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: NOW.getTime() / 1000 + 12 * 60 * 60,
      sub: 'mailto:reminder@example.com',
    });
    expect(k).toBe(vapid.publicKey);
    const verified = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      vapid.verifyKey,
      fromBase64Url(signature),
      encoder.encode(`${head}.${claims}`),
    );
    expect(verified).toBe(true);
  });
});

describe('sendPush', () => {
  it('posts the encrypted message with the headers a push service wants, and resolves its status', async () => {
    const keys = await phone();
    const vapid = await vapidKeys();
    const fetcher = vi.fn(async () => new Response(null, { status: 201 }));

    const status = await sendPush({ endpoint: FCM, ...keys }, '{"title":"StudentsBudget"}', vapid, { ttlSeconds: 43200, topic: 'weekly-reminder' }, NOW, fetcher);

    expect(status).toBe(201);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string>; body: Uint8Array<ArrayBuffer> }];
    expect(url).toBe(FCM);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '43200',
      Urgency: 'normal',
      Topic: 'weekly-reminder',
    });
    expect(init.headers.Authorization).toMatch(/^vapid t=.+, k=/);
    expect((await decrypt(init.body, keys)).text).toBe('{"title":"StudentsBudget"}');
  });

  it('never posts to an address that is not a known push service’s', async () => {
    const keys = await phone();
    const fetcher = vi.fn(async () => new Response(null, { status: 201 }));
    await expect(
      sendPush({ endpoint: 'https://example.com/fcm.googleapis.com/x', ...keys }, '{}', await vapidKeys(), { ttlSeconds: 60 }, NOW, fetcher),
    ).rejects.toThrow('push service');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('PUSH_ENDPOINT', () => {
  it('is the check the table makes', () => {
    const migration = readFileSync('supabase/migrations/20261105144946_push_subscriptions.sql', 'utf8');
    const inTable = /endpoint ~ '([^']+)'/.exec(migration)?.[1];
    expect(PUSH_ENDPOINT.source.replace(/\\\//g, '/')).toBe(inTable);
  });

  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://web.push.apple.com/QF4bJ',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAA',
    'https://wns2-par02p.notify.windows.com/w/?token=BQYA',
  ])('takes %s', (endpoint) => {
    expect(PUSH_ENDPOINT.test(endpoint)).toBe(true);
  });

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com.example.com/x',
    'https://example.com/fcm.googleapis.com/x',
    'https://push.apple.com.example.com/x',
  ])('refuses %s', (endpoint) => {
    expect(PUSH_ENDPOINT.test(endpoint)).toBe(false);
  });
});

/**
 * A new random id: an RFC 4122 version-4 UUID.
 *
 * `crypto.randomUUID` only exists in a secure context (HTTPS or localhost). On a plain-HTTP address, such as the
 * PC's LAN address opened from a phone, it is missing and calling it throws. `crypto.getRandomValues` exists on
 * every origin, so the id is built from that when the native function is not there.
 */
export function newId(): string {
  // eslint-disable-next-line no-restricted-properties -- the one allowed use: it is checked before it is called
  const randomUUID = crypto.randomUUID;
  if (typeof randomUUID === 'function') return randomUUID.call(crypto);

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

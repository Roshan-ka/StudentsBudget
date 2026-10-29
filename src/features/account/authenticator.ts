// What Settings shows while an authenticator app is added to an account (two-step sign-in, P2.3a).

/**
 * supabase-js hands the QR code over as `data:image/svg+xml;utf-8,` and the raw SVG. Supabase's docs advise encoding
 * it before an <img> uses it, since characters such as # end a URL. Anything else is passed on as it is.
 */
export function qrImageSource(qrCode: string): string {
  const prefix = 'data:image/svg+xml;utf-8,';
  return qrCode.startsWith(prefix)
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode.slice(prefix.length))}`
    : qrCode;
}

/** The key in groups of four, which is easier to type into an authenticator app: "JBSW Y3DP EHPK 3PXP". */
export function groupedSecret(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, '$1 ');
}

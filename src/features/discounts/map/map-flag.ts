/**
 * Whether this build shows the discount map (docs/superpowers/plans/2026-11-11-discount-map.md): set with
 * `NEXT_PUBLIC_DISCOUNT_MAP=1` in the e2e build and on Vercel previews, and in Production once its real try is done,
 * so nobody meets a look Roshan hasn't approved. Without it, Discounts is the list alone.
 */
export function mapInBuild(): boolean {
  // Written out in full, so Next puts the value in the build.
  return process.env.NEXT_PUBLIC_DISCOUNT_MAP === '1';
}

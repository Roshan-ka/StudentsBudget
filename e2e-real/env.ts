// The real-server build's address. A fixed port: a passkey is checked against the page's origin, and
// supabase/config.toml lists http://localhost:3210 in rp_origins. Not 3200 (test:e2e) or 3100 (test:offline), so the
// mocked builds and this one never answer for each other.
export const REAL_PORT = Number(process.env.E2E_REAL_PORT ?? 3210);
export const REAL_BASE_URL = `http://localhost:${REAL_PORT}`;

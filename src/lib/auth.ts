/**
 * Eén wachtwoord voor de browser, één afgeleide sleutel voor alles wat geen
 * browser is (Snelkoppelingen, cron, MCP). De sleutel is afgeleid van het
 * wachtwoord, dus je hoeft nergens je wachtwoord zelf achter te laten.
 */

export const COOKIE = "vault_session";
const YEAR_SECONDS = 60 * 60 * 24 * 365;

function secret(): string {
  return (
    process.env.VAULT_SECRET ||
    process.env.VAULT_PASSWORD ||
    "vault-lokaal-zonder-wachtwoord"
  );
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ── Sessiecookie voor de browser ─────────────────────────────────────── */

export async function createToken(): Promise<string> {
  const payload = `v1.${Date.now() + YEAR_SECONDS * 1000}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function isValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [version, expiry, signature] = parts;
  if (version !== "v1") return false;
  if (!Number(expiry) || Number(expiry) < Date.now()) return false;

  return timingSafeEqual(signature, await hmac(`${version}.${expiry}`));
}

/* ── API-sleutel voor Snelkoppelingen, cron en MCP ────────────────────── */

export async function apiKey(): Promise<string> {
  return (await hmac("api-sleutel-v1")).slice(0, 32);
}

export async function isValidApiKey(candidate: string | null): Promise<boolean> {
  if (!candidate) return false;
  return timingSafeEqual(candidate, await apiKey());
}

/**
 * Accepteert drie soorten toegang: de sessiecookie van de browser, de
 * API-sleutel (header of ?key=), en de cron van Vercel.
 */
export async function isAuthorized(request: {
  cookies: { get: (name: string) => { value: string } | undefined };
  headers: { get: (name: string) => string | null };
  nextUrl: { searchParams: URLSearchParams };
}): Promise<boolean> {
  if (await isValidToken(request.cookies.get(COOKIE)?.value)) return true;

  const provided =
    request.headers.get("x-vault-key") ?? request.nextUrl.searchParams.get("key");
  if (await isValidApiKey(provided)) return true;

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) {
    return true;
  }

  return false;
}

/** Zonder wachtwoord is de vault open — prima lokaal, nooit in productie. */
export function authRequired(): boolean {
  return Boolean(process.env.VAULT_PASSWORD) || process.env.NODE_ENV === "production";
}

export const MAX_AGE = YEAR_SECONDS;

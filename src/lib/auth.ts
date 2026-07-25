/**
 * Eén wachtwoord, één langlopende cookie. Genoeg voor een privévault, en het
 * werkt in de middleware (edge runtime) omdat het alleen Web Crypto gebruikt.
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

async function sign(payload: string): Promise<string> {
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

export async function createToken(): Promise<string> {
  const payload = `v1.${Date.now() + YEAR_SECONDS * 1000}`;
  return `${payload}.${await sign(payload)}`;
}

export async function isValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [version, expiry, signature] = parts;
  if (version !== "v1") return false;
  if (!Number(expiry) || Number(expiry) < Date.now()) return false;

  const expected = await sign(`${version}.${expiry}`);
  return timingSafeEqual(signature, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Zonder wachtwoord is de vault open — prima lokaal, nooit in productie. */
export function authRequired(): boolean {
  return Boolean(process.env.VAULT_PASSWORD) || process.env.NODE_ENV === "production";
}

export const MAX_AGE = YEAR_SECONDS;

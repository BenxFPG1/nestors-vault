import { timingSafeEqual } from "./auth";

/**
 * Een moodboard-link is een ondertekende lijst met item-id's. Geen database
 * nodig: alles zit in de link zelf, en zonder de handtekening kan niemand er
 * items aan toevoegen of de vervaldatum oprekken.
 */

type Payload = { ids: string[]; exp: number; title: string };

function secret(): string {
  return (
    process.env.VAULT_SECRET || process.env.VAULT_PASSWORD || "vault-lokaal-zonder-wachtwoord"
  );
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${secret()}|deel`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64url(new Uint8Array(signature));
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export async function createShareLink(
  ids: string[],
  options: { days?: number; title?: string } = {},
): Promise<string> {
  const payload: Payload = {
    ids,
    exp: Date.now() + (options.days ?? 30) * 24 * 60 * 60 * 1000,
    title: (options.title ?? "").slice(0, 80),
  };

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${await sign(body)}`;
}

export async function readShareLink(token: string): Promise<Payload | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  if (!timingSafeEqual(signature, await sign(body))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Payload;

    if (!Array.isArray(payload.ids) || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

import { NextResponse } from "next/server";
import { COOKIE, createToken, MAX_AGE } from "@/lib/auth";

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string };
  const expected = process.env.VAULT_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { error: "Er is nog geen wachtwoord ingesteld op de server." },
      { status: 503 },
    );
  }

  if (!password || password !== expected) {
    // Kleine vertraging, zodat raden traag en onaantrekkelijk blijft.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return NextResponse.json({ error: "Verkeerd wachtwoord." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, await createToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return response;
}

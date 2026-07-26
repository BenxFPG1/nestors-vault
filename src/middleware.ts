import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized, authRequired } from "@/lib/auth";

export const config = {
  // Openbaar: inlogpagina, deel-moodboard en assets. De MCP-route bewaakt
  // zichzelf met de sleutel in het pad. Al het andere gaat door de poort.
  matcher: [
    "/((?!login|deel|api/login|api/deel|api/mcp|_next/static|_next/image|icons|manifest).*)",
  ],
};

export async function middleware(request: NextRequest) {
  if (!authRequired()) return NextResponse.next();

  if (!process.env.VAULT_PASSWORD) {
    return new NextResponse(
      "VAULT_PASSWORD is niet ingesteld op de server. De vault blijft dicht totdat dat gebeurt.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  if (await isAuthorized(request)) return NextResponse.next();

  // API-aanroepen krijgen een nette 401 in plaats van een omleiding.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

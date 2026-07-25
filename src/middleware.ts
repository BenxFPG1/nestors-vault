import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, isValidToken, authRequired } from "@/lib/auth";

export const config = {
  // Alles afschermen behalve de inlogpagina, het icoon en de Next-assets.
  matcher: ["/((?!login|api/login|_next/static|_next/image|icons|manifest).*)"],
};

export async function middleware(request: NextRequest) {
  if (!authRequired()) return NextResponse.next();

  if (!process.env.VAULT_PASSWORD) {
    return new NextResponse(
      "VAULT_PASSWORD is niet ingesteld op de server. De vault blijft dicht totdat dat gebeurt.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  if (await isValidToken(request.cookies.get(COOKIE)?.value)) {
    return NextResponse.next();
  }

  // API-aanroepen krijgen een nette 401 in plaats van een omleiding.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

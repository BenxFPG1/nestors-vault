import { NextResponse } from "next/server";
import { isValidApiKey } from "@/lib/auth";
import { handleMcp, toolsFor } from "@/lib/mcp";

/**
 * Dezelfde gereedschappen, maar afgeschermd tot één project. Wie deze link
 * heeft, ziet uitsluitend de referenties die aan dat project gekoppeld zijn —
 * de rest van de vault bestaat voor hem niet.
 */

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string; project: string }> },
) {
  const { key, project } = await params;
  if (!(await isValidApiKey(key))) return new Response("Niet gevonden", { status: 404 });

  return handleMcp(request, decodeURIComponent(project));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string; project: string }> },
) {
  const { key, project } = await params;
  if (!(await isValidApiKey(key))) return new Response("Niet gevonden", { status: 404 });

  const scope = decodeURIComponent(project);
  return NextResponse.json({
    name: `vault: ${scope}`,
    transport: "streamable-http",
    tools: toolsFor(scope).length,
  });
}

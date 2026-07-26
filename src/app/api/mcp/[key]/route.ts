import { NextResponse } from "next/server";
import { isValidApiKey } from "@/lib/auth";
import { handleMcp, toolsFor } from "@/lib/mcp";

/**
 * De volledige vault voor AI-clients. De sleutel zit in het pad, omdat
 * MCP-clients zelden losse headers kunnen meesturen; zonder geldige sleutel
 * bestaat dit eindpunt simpelweg niet.
 */

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  if (!(await isValidApiKey(key))) return new Response("Niet gevonden", { status: 404 });

  return handleMcp(request, null);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  if (!(await isValidApiKey(key))) return new Response("Niet gevonden", { status: 404 });

  return NextResponse.json({
    name: "vault",
    transport: "streamable-http",
    tools: toolsFor(null).length,
  });
}

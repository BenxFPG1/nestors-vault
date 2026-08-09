import { NextResponse } from "next/server";
import { startTagWorkflow } from "@/lib/github";

/**
 * Trapt de tagronde op GitHub Actions af (abonnement, geen API-tegoed).
 * `started: false` betekent: geen GITHUB_ACTIONS_TOKEN ingesteld of GitHub
 * weigerde — de aanroeper kan dan terugvallen op /api/tag.
 */
export async function POST() {
  return NextResponse.json({ started: await startTagWorkflow() });
}

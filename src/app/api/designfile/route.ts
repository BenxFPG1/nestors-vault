import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { allItems } from "@/lib/store";
import { listBriefings, getDesignfile, saveDesignfile } from "@/lib/notion";

export const maxDuration = 120;

const MODEL = process.env.VAULT_TAGGING_MODEL || "claude-opus-5";

const TEMPLATE = `# Designfile — {project}

## Doel & context
## Doelgroep
## Merkpersoonlijkheid (3–5 woorden)
## Stijlrichting
## Kleur
## Typografie
## Layout & compositie
## Motion & interactie
## Do's
## Don'ts
## Referentie-hoogtepunten`;

const SYSTEM = `Je bent creatief directeur van een Nederlandse creative studio. Je schrijft
een designfile: hét werkdocument waarmee een ontwerper of AI direct aan de slag kan.

Regels:
- Schrijf in het Nederlands, concreet en zonder marketingtaal.
- Baseer je uitsluitend op de meegegeven referenties en briefing; verzin geen
  voorkeuren die daar niet uit blijken. Benoem twijfel expliciet als open vraag.
- Kleuren als hex-codes overnemen uit de referenties waar dat kan.
- Bij "Referentie-hoogtepunten": noem 3-5 opgeslagen items bij titel en zeg wat
  eruit te halen valt.
- Do's en don'ts: elk 4-6 punten, kort en toetsbaar.
- Volg exact deze indeling:\n\n`;

export async function GET(request: Request) {
  const project = new URL(request.url).searchParams.get("project");
  if (!project) return NextResponse.json({ error: "project ontbreekt" }, { status: 400 });
  return NextResponse.json({ content: await getDesignfile(project) });
}

export async function POST(request: Request) {
  try {
    const { project, content } = (await request.json()) as { project?: string; content?: string };
    if (!project) return NextResponse.json({ error: "project ontbreekt" }, { status: 400 });

    // handmatig bewerkte versie opslaan
    if (typeof content === "string") {
      await saveDesignfile(project, content);
      return NextResponse.json({ ok: true });
    }

    // genereren op basis van de items in dit project
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY ontbreekt" }, { status: 500 });
    }

    const [items, briefings] = await Promise.all([allItems(), listBriefings()]);
    const mine = items.filter((item) => item.projects.includes(project));
    const briefing = briefings.find((entry) => entry.project === project)?.text ?? "";

    if (!mine.length && !briefing) {
      return NextResponse.json(
        { error: "Dit project heeft nog geen referenties of briefing om op te bouwen." },
        { status: 400 },
      );
    }

    const referenties = mine
      .map((item) =>
        [
          `- ${item.title || "Zonder titel"}`,
          item.style ? `  stijl: ${item.style}` : null,
          item.tags.length ? `  tags: ${item.tags.join(", ")}` : null,
          item.colors.length ? `  kleuren: ${item.colors.join(" ")}` : null,
          item.notes ? `  waarom bewaard: ${item.notes}` : null,
          item.description ? `  beschrijving: ${item.description}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n");

    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: SYSTEM + TEMPLATE.replace("{project}", project),
      messages: [
        {
          role: "user",
          content: `Project: ${project}\n\nBriefing:\n${briefing || "(geen briefing)"}\n\nOpgeslagen referenties (${mine.length}):\n${referenties || "(geen)"}\n\nSchrijf de designfile.`,
        },
      ],
    });

    const tekst = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();

    if (!tekst) throw new Error("Leeg antwoord van het model");

    await saveDesignfile(project, tekst);
    return NextResponse.json({ content: tekst });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Designfile maken mislukt" },
      { status: 500 },
    );
  }
}

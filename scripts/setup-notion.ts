/**
 * Maakt de Vault-database in Notion aan onder een pagina die je met de
 * integratie hebt gedeeld. Draaien met: npm run setup:notion
 */
import "./env";
import fs from "node:fs";
import path from "node:path";
import { Client } from "@notionhq/client";
import { CATEGORIES, TAGS } from "../src/lib/taxonomy";
import { PROPS } from "../src/lib/notion";

/* eslint-disable @typescript-eslint/no-explicit-any */

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error(
    "NOTION_TOKEN ontbreekt.\n\n" +
      "1. Ga naar https://www.notion.so/profile/integrations\n" +
      "2. New integration → naam 'Vault' → kies je workspace\n" +
      "3. Kopieer de Internal Integration Secret naar .env.local als NOTION_TOKEN\n" +
      "4. Open in Notion de pagina waar de vault moet komen → ••• → Connections → Vault\n",
  );
  process.exit(1);
}

const notion = new Client({ auth: token });

const search: any = await notion.search({
  filter: { value: "page", property: "object" },
  page_size: 25,
});

const pages = search.results.filter((p: any) => p.object === "page");

if (pages.length === 0) {
  console.error(
    "Geen pagina's gevonden die met de integratie gedeeld zijn.\n" +
      "Open in Notion de pagina waar de vault moet komen → ••• → Connections → voeg 'Vault' toe.",
  );
  process.exit(1);
}

const titleOf = (page: any): string => {
  const prop: any = Object.values(page.properties ?? {}).find(
    (p: any) => p.type === "title",
  );
  return prop?.title?.map((t: any) => t.plain_text).join("") || "(zonder titel)";
};

const wanted = process.argv[2];
let parent = pages[0];

if (wanted) {
  const match = pages.find(
    (p: any) => p.id === wanted || p.id.replace(/-/g, "") === wanted.replace(/-/g, ""),
  );
  if (!match) {
    console.error(`Pagina ${wanted} niet gevonden tussen de gedeelde pagina's.`);
    process.exit(1);
  }
  parent = match;
} else if (pages.length > 1) {
  console.log("Meerdere gedeelde pagina's gevonden:\n");
  for (const page of pages) console.log(`  ${page.id}  ${titleOf(page)}`);
  console.log(`\nIk gebruik de eerste: "${titleOf(parent)}".`);
  console.log("Een andere? Draai: npm run setup:notion -- <pagina-id>\n");
}

const database: any = await notion.databases.create({
  parent: { type: "page_id", page_id: parent.id },
  title: [{ type: "text", text: { content: "Vault" } }],
  properties: {
    [PROPS.title]: { title: {} },
    [PROPS.category]: {
      select: { options: CATEGORIES.map((name) => ({ name })) },
    },
    [PROPS.tags]: {
      multi_select: { options: TAGS.map((name) => ({ name })) },
    },
    [PROPS.colors]: { rich_text: {} },
    [PROPS.style]: { rich_text: {} },
    [PROPS.description]: { rich_text: {} },
    [PROPS.url]: { url: {} },
    [PROPS.file]: { files: {} },
    [PROPS.status]: {
      select: {
        options: [
          { name: "nieuw", color: "gray" },
          { name: "getagd", color: "green" },
          { name: "mislukt", color: "red" },
        ],
      },
    },
    [PROPS.notes]: { rich_text: {} },
  },
});

console.log(`\nDatabase aangemaakt in "${titleOf(parent)}"`);
console.log(`   ${database.url}\n`);

const envPath = path.join(process.cwd(), ".env.local");
const line = `NOTION_DATABASE_ID=${database.id}`;

if (fs.existsSync(envPath)) {
  const current = fs.readFileSync(envPath, "utf8");
  const next = /^NOTION_DATABASE_ID=.*$/m.test(current)
    ? current.replace(/^NOTION_DATABASE_ID=.*$/m, line)
    : `${current.trimEnd()}\n${line}\n`;
  fs.writeFileSync(envPath, next);
  console.log(`NOTION_DATABASE_ID weggeschreven naar .env.local`);
} else {
  console.log(`Zet dit in .env.local:\n\n${line}\n`);
}

/**
 * Zet de hele vault op je eigen schijf.
 *
 *   npm run backup
 *   npm run backup -- ~/Dropbox/vault-backup
 *
 * Alles staat in Notion — handig, maar het is wel één mandje met alle eieren.
 * Dit schrijft de gegevens weg als JSON en haalt elke afbeelding op, zodat je
 * archief blijft bestaan als er met Notion of met dit project iets gebeurt.
 *
 * Afbeeldingen die er al staan worden overgeslagen, dus een tweede keer
 * draaien is snel en je kunt het gerust afbreken.
 */
import "./env";
import fs from "node:fs";
import path from "node:path";
import { listItems, imageUrl, listBriefings, listProjects } from "../src/lib/notion";

const doel = path.resolve(
  (process.argv[2] ?? "./backup").replace(/^~/, process.env.HOME ?? "~"),
);
const beeldMap = path.join(doel, "afbeeldingen");

fs.mkdirSync(beeldMap, { recursive: true });

console.log(`Back-up naar ${doel}\n`);

const items = await listItems();
const projecten = await listProjects();
const briefings = await listBriefings();

let opgehaald = 0;
let overgeslagen = 0;
let mislukt = 0;

for (const [nummer, item] of items.entries()) {
  const label = `${nummer + 1}/${items.length}`;
  if (!item.hasImage) {
    console.log(`${label}  ${item.title || item.id} — geen beeld`);
    continue;
  }

  const bestand = path.join(beeldMap, `${item.id}.jpg`);
  if (fs.existsSync(bestand) && fs.statSync(bestand).size > 1000) {
    overgeslagen++;
    continue;
  }

  try {
    const bron = await imageUrl(item.id);
    if (!bron) throw new Error("geen bron-URL");

    const antwoord = await fetch(bron);
    if (!antwoord.ok) throw new Error(`status ${antwoord.status}`);

    fs.writeFileSync(bestand, Buffer.from(await antwoord.arrayBuffer()));
    opgehaald++;
    console.log(`${label}  ${item.title || item.id}`);
  } catch (error) {
    mislukt++;
    console.log(
      `${label}  MISLUKT ${item.title || item.id} — ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

// De gegevens los van de beelden, zodat je er ook met een simpel script bij kunt.
fs.writeFileSync(
  path.join(doel, "vault.json"),
  JSON.stringify({ gemaakt: new Date().toISOString(), projecten, briefings, items }, null, 2),
);

// En een leesbare index, voor als je hier over drie jaar in terechtkomt.
const regels = [
  `# Vault-back-up`,
  ``,
  `${items.length} items · ${projecten.length} projecten`,
  ``,
  `De gegevens staan in vault.json, de beelden in afbeeldingen/ met het item-id als naam.`,
  ``,
  ...items.map((item) =>
    [
      `## ${item.title || "Zonder titel"}`,
      `${item.category}${item.tags.length ? ` · ${item.tags.join(", ")}` : ""}`,
      item.description,
      item.sourceUrl ? `Bron: ${item.sourceUrl}` : null,
      item.hasImage ? `Beeld: afbeeldingen/${item.id}.jpg` : null,
      ...item.annotations.map((note) => `- ${note.text}`),
      ``,
    ]
      .filter(Boolean)
      .join("\n"),
  ),
];

fs.writeFileSync(path.join(doel, "index.md"), regels.join("\n"));

console.log(
  `\nKlaar — ${opgehaald} opgehaald, ${overgeslagen} al aanwezig, ${mislukt} mislukt.`,
);
console.log(`Gegevens: ${path.join(doel, "vault.json")}`);
console.log(`Overzicht: ${path.join(doel, "index.md")}`);

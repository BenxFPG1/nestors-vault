/**
 * Zoekt items die op elkaar lijken.
 *
 *   npm run dubbel
 *
 * Vergelijkt de vingerafdruk van elk beeld met alle andere. Items die er
 * waren vóór de vingerafdrukken bestonden krijgen er alsnog een, dus dit
 * werkt ook op je oudere spullen.
 *
 * Verwijderen doet dit script bewust niet — het laat zien wat het vond en
 * geeft je de Notion-links. Welke van twee de betere is, kan alleen jij zien.
 */
import "./env";
import { notion, listItems, imageUrl, PROPS, type Item } from "../src/lib/notion";
import { fingerprint, distance, DUPLICATE_THRESHOLD } from "../src/lib/fingerprint";

const items = await listItems();
const metBeeld = items.filter((item) => item.hasImage);

console.log(`${metBeeld.length} items met beeld.\n`);

// Ontbrekende vingerafdrukken alsnog berekenen en bewaren.
const afdrukken = new Map<string, string>();
let berekend = 0;

for (const item of metBeeld) {
  if (item.fingerprint) {
    afdrukken.set(item.id, item.fingerprint);
    continue;
  }

  try {
    const bron = await imageUrl(item.id);
    if (!bron) continue;

    const antwoord = await fetch(bron);
    if (!antwoord.ok) continue;

    const afdruk = await fingerprint(Buffer.from(await antwoord.arrayBuffer()));
    afdrukken.set(item.id, afdruk);
    berekend++;

    await notion().pages.update({
      page_id: item.id,
      properties: {
        [PROPS.fingerprint]: {
          rich_text: [{ type: "text", text: { content: afdruk } }],
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  } catch {
    // beeld niet op te halen; dan doet dit item gewoon niet mee
  }
}

if (berekend) console.log(`${berekend} vingerafdrukken alsnog berekend.\n`);

const paren: { a: Item; b: Item; afstand: number }[] = [];

for (let i = 0; i < metBeeld.length; i++) {
  for (let j = i + 1; j < metBeeld.length; j++) {
    const eerste = afdrukken.get(metBeeld[i].id);
    const tweede = afdrukken.get(metBeeld[j].id);
    if (!eerste || !tweede) continue;

    const afstand = distance(eerste, tweede);
    if (afstand < DUPLICATE_THRESHOLD) {
      paren.push({ a: metBeeld[i], b: metBeeld[j], afstand });
    }
  }
}

if (paren.length === 0) {
  console.log("Geen dubbelingen gevonden.");
  process.exit(0);
}

console.log(`${paren.length} mogelijke dubbeling${paren.length === 1 ? "" : "en"}:\n`);

for (const { a, b, afstand } of paren.sort((x, y) => x.afstand - y.afstand)) {
  const zeker = afstand === 0 ? "identiek" : `${afstand} bits verschil`;
  console.log(`— ${zeker}`);
  for (const item of [a, b]) {
    const wanneer = new Date(item.createdAt).toLocaleDateString("nl-NL");
    console.log(`    ${item.title || "zonder titel"}  (${item.category}, ${wanneer})`);
    console.log(`    ${item.notionUrl}`);
  }
  console.log();
}

console.log("Open de vault, klik het item aan en gebruik 'verwijder' om er een op te ruimen.");

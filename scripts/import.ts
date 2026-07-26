/**
 * Zet een map vol screenshots in één keer in de vault.
 *
 *   npm run import -- ~/Desktop/inspiratie
 *   npm run import -- ~/Desktop/inspiratie --notitie "oude map, 2024"
 *
 * Houdt bij wat al binnen is in data/import-log.json, dus je kunt het
 * gerust afbreken en later opnieuw draaien.
 */
import "./env";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { createPage, attachImage, saveTags } from "../src/lib/notion";
import { tagImage } from "../src/lib/tagger";

const EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic", ".avif"]);
const LOG_PATH = path.join(process.cwd(), "data", "import-log.json");

const folder = process.argv[2];
if (!folder) {
  console.error("Geef een map op:  npm run import -- ~/Desktop/inspiratie");
  process.exit(1);
}

const noteIndex = process.argv.indexOf("--notitie");
const sharedNote = noteIndex > -1 ? (process.argv[noteIndex + 1] ?? "") : "";

const root = path.resolve(folder.replace(/^~/, process.env.HOME ?? "~"));
if (!fs.existsSync(root)) {
  console.error(`Map bestaat niet: ${root}`);
  process.exit(1);
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ? [full] : [];
  });
}

type Log = Record<string, string>;
const log: Log = fs.existsSync(LOG_PATH)
  ? JSON.parse(fs.readFileSync(LOG_PATH, "utf8"))
  : {};

function remember(hash: string, id: string) {
  log[hash] = id;
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

const files = walk(root);
console.log(`${files.length} afbeeldingen gevonden in ${root}\n`);

let done = 0;
let skipped = 0;
let failed = 0;

for (const [index, file] of files.entries()) {
  const raw = fs.readFileSync(file);
  const hash = crypto.createHash("sha256").update(new Uint8Array(raw)).digest("hex");
  const label = `${index + 1}/${files.length} ${path.basename(file)}`;

  if (log[hash]) {
    skipped++;
    console.log(`${label} — al geïmporteerd`);
    continue;
  }

  try {
    // Alles door sharp: dat vangt HEIC van de iPhone en te grote bestanden op.
    const meta = await sharp(raw).metadata();
    const tooBig = raw.byteLength > 4_000_000;
    const known = ["png", "jpeg", "webp", "gif"].includes(meta.format ?? "");

    const data =
      known && !tooBig
        ? raw
        : await sharp(raw)
            .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 88 })
            .toBuffer();

    const type = known && !tooBig ? `image/${meta.format}` : "image/jpeg";
    const name = known && !tooBig ? path.basename(file) : `${path.parse(file).name}.jpg`;

    const page = await createPage({
      notes: [sharedNote, `geïmporteerd uit ${path.relative(root, file)}`]
        .filter(Boolean)
        .join(" · "),
      sourceUrl: null,
      fileUploadId: null,
      fileName: null,
    });

    await attachImage(page.id, data, name, type);

    const result = await tagImage({ data, type }, { notes: sharedNote, title: null });
    await saveTags(page.id, result);

    remember(hash, page.id);
    done++;
    console.log(`${label} — ${result.title} (${result.category})`);
  } catch (error) {
    failed++;
    console.log(
      `${label} — MISLUKT: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

console.log(
  `\nKlaar — ${done} toegevoegd, ${skipped} overgeslagen, ${failed} mislukt.`,
);

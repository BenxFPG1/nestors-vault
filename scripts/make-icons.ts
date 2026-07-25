/** Genereert de app-iconen voor het beginscherm. Draaien met: npx tsx scripts/make-icons.ts */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "icons");
fs.mkdirSync(OUT, { recursive: true });

// Een klein rastertje van kaarten — herkenbaar als galerij, ook op 40 pixels.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0e0e0f"/>
  <rect x="96"  y="96"  width="140" height="200" rx="20" fill="#f2f0eb"/>
  <rect x="96"  y="316" width="140" height="100" rx="20" fill="#3a3a41"/>
  <rect x="276" y="96"  width="140" height="110" rx="20" fill="#c9714d"/>
  <rect x="276" y="226" width="140" height="190" rx="20" fill="#8d8b85"/>
</svg>`;

const source = Buffer.from(svg);

for (const size of [180, 192, 512]) {
  const file = path.join(OUT, `icon-${size}.png`);
  await sharp(source).resize(size, size).png().toFile(file);
  console.log("geschreven:", path.relative(process.cwd(), file));
}

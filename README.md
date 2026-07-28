# Vault

Een privé inspiratiebibliotheek. Je zet er screenshots en links in, Claude beschrijft
en tagt ze automatisch, en je doorzoekt alles in een rustig grid. Notion is de opslag —
er is geen tweede database. Een MCP-server ontsluit dezelfde vault voor AI, zodat Claude
tijdens het bouwen jouw eigen referenties kan pakken.

```
toevoegen (web of Notion)  →  Notion  →  webapp
                                     └→  MCP-server
```

Omdat alles in Notion staat, heeft de webapp geen eigen schijf nodig. Daardoor kan hij
gratis online draaien.

## Eenmalig instellen

**1. Notion-integratie aanmaken**

- Ga naar https://www.notion.so/profile/integrations
- *New integration* → naam `Vault` → kies je workspace → opslaan
- Kopieer de *Internal Integration Secret*

**2. Sleutels invullen**

```bash
cp .env.example .env.local
```

Vul in: `NOTION_TOKEN`, `ANTHROPIC_API_KEY` (via https://platform.claude.com) en
`VAULT_PASSWORD` (verzin er zelf een).

**3. Pagina delen en database aanmaken**

Open in Notion de pagina waar de vault mag komen → `•••` → *Connections* → voeg `Vault`
toe. Dan:

```bash
npm run setup:notion
```

Dit maakt de database met alle kolommen aan en schrijft `NOTION_DATABASE_ID` naar
`.env.local`.

**4. Starten**

```bash
npm run dev
```

http://localhost:3939

## Dagelijks gebruik

Bovenaan de vault staat een balk: kies een foto of screenshot, of plak een link. Op de
desktop kun je een afbeelding ook het venster in slepen of plakken met Cmd+V.

Wat er gebeurt: het item wordt in Notion aangemaakt, de afbeelding gaat mee, en Claude
tagt hem meteen. Bij een link halen we eerst een screenshot op bij Microlink; lukt dat
niet, dan pakken we de deelafbeelding van de site zelf.

Voeg je iets rechtstreeks in Notion toe, dan verschijnt het zonder tags in de vault. De
knop **Tag rest** werkt die achterstand weg, drie items per klik.

## Online zetten (gratis, op Vercel)

**1. In git zetten en naar GitHub duwen**

```bash
git init && git add -A && git commit -m "Vault"
gh repo create nestors-vault --private --source=. --push
```

**2. Naar Vercel**

Ga naar https://vercel.com/new, kies de repo, en zet vóór het deployen deze
omgevingsvariabelen klaar:

| Naam | Waarde |
| --- | --- |
| `NOTION_TOKEN` | jouw Notion-token |
| `NOTION_DATABASE_ID` | staat in je `.env.local` |
| `ANTHROPIC_API_KEY` | jouw Anthropic-key |
| `VAULT_PASSWORD` | het wachtwoord voor de vault |
| `VAULT_TAGGING_MODEL` | optioneel, bv. `claude-haiku-4-5` |

Zonder `VAULT_PASSWORD` weigert de app open te gaan — dat is met opzet, zodat een
vergeten instelling nooit een open vault oplevert.

**3. Eigen adres**

In Vercel bij *Settings → Domains* voeg je `vault.nestorscreate.nl` toe. Vercel geeft
je een CNAME-waarde. Die zet je bij Hostinger onder *DNS*:

```
Type: CNAME   Naam: vault   Waarde: <wat Vercel je geeft>
```

Je bestaande site op `nestorscreate.nl` blijft daarbij ongemoeid.

**4. Op je beginscherm**

Open `vault.nestorscreate.nl` op je telefoon, log één keer in, en kies in het
deelmenu *Zet op beginscherm*. Hij opent daarna zonder browserbalk, als een app, en
je blijft een jaar ingelogd.

## Onderhoud en gereedschap

| Commando | Wat het doet |
| --- | --- |
| `npm run backup -- ~/pad/naar/map` | Zet de hele vault op je eigen schijf: `vault.json`, een leesbare `index.md` en alle beelden. Alles hangt aan één Notion-database, dus dit is je vangnet. Beelden die er al staan worden overgeslagen. |
| `npm run dubbel` | Zoekt items die op elkaar lijken, op basis van de vingerafdruk van het beeld. Verwijdert niets — welke van twee de betere is, zie alleen jij. |
| `npm run import -- ~/pad/naar/map` | Zet een map vol screenshots in één keer in de vault. |
| `npm run tag:lokaal` | Tagt via Claude Code op je abonnement in plaats van via API-tegoed. Alleen op deze Mac; handig voor grote inhaalslagen. |

## Ontwerprichting

Op elke projectpagina staat **Ontwerprichting**. Die leest de briefing, de referenties en
vooral jouw eigen opmerkingen, en schrijft er een richting uit: kern, typografie, kleur,
compositie, een palet, en — het nuttigste — waar de referenties elkaar tegenspreken.

Bedoeld als startpunt voor een gesprek. Hoe meer opmerkingen je bij items zet, hoe scherper
het wordt: die vertellen waaróm je iets bewaarde, en dat is wat een stapel screenshots
zelf niet prijsgeeft.

## MCP-server

```bash
claude mcp add vault -- npx tsx "/Users/antonie/Documents/Antonie/Cursor/Nestors Vault/mcp/server.ts"
```

Drie tools: `zoek_inspiratie` (zoekt op woorden en stuurt de screenshots mee),
`toon_item` en `vault_overzicht`. In de praktijk vraag je gewoon: *"pak drie
hero-secties uit m'n vault als referentie"*.

Draait lokaal en leest rechtstreeks uit Notion, dus werkt ook als de webapp uit staat.

## Taxonomie aanpassen

Categorieën en tags staan in `src/lib/taxonomy.ts`, en de AI mag daar niet buiten
kleuren. Zonder die rem krijg je na tweehonderd items "donker" naast "dark" naast
"dark-mode" en werkt filteren niet meer. Toevoegen mag altijd; na een wijziging moet
je de bijbehorende kolom in Notion zelf even bijwerken.

## Waar staat wat

| Pad | Wat |
| --- | --- |
| `src/lib/notion.ts` | De opslag: lezen, schrijven, bestanden op- en afhalen |
| `src/lib/store.ts` | Cache, zoeken en filteren |
| `src/lib/tagger.ts` | De Claude-prompt en het schema van het tag-antwoord |
| `src/lib/preview.ts` | Beeld bij een losse link |
| `src/lib/auth.ts` | Wachtwoord en de cookie die een jaar meegaat |
| `src/lib/taxonomy.ts` | Toegestane categorieën en tags |
| `src/app/api/upload/` | Toevoegen vanuit de app |
| `src/app/api/tag/` | Achterstand wegwerken |
| `mcp/server.ts` | MCP-tools voor AI-clients |

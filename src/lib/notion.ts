import { Client } from "@notionhq/client";

/**
 * Notion is de opslag. Er is geen tweede database meer: alles wat de vault
 * weet — tekst, tags én de afbeeldingen — staat hier. Daardoor heeft de
 * webversie geen eigen schijf nodig en kan hij gratis draaien.
 */

export const PROPS = {
  title: "Naam",
  category: "Categorie",
  tags: "Tags",
  colors: "Kleuren",
  style: "Stijl",
  description: "Beschrijving",
  url: "URL",
  file: "Bestand",
  status: "Status",
  notes: "Notities",
  projects: "Projecten",
  annotations: "Aantekeningen",
} as const;

/**
 * Een aantekening is een opmerking bij een item. Staat er een positie bij,
 * dan hoort hij bij een plek op het beeld — dat is de omcirkeling. Zonder
 * positie is het gewoon een opmerking bij het item als geheel.
 */
export type Annotation = {
  id: string;
  text: string;
  at: string;
  /** Percentages van 0 tot 100, zodat ze op elk schermformaat kloppen. */
  box?: { x: number; y: number; w: number; h: number };
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyPage = any;

const API = "https://api.notion.com/v1";

let client: Client | null = null;

export function notion(): Client {
  if (client) return client;
  const auth = process.env.NOTION_TOKEN;
  if (!auth) throw new Error("NOTION_TOKEN ontbreekt");
  client = new Client({ auth });
  return client;
}

export function databaseId(): string {
  const id = process.env.NOTION_DATABASE_ID;
  if (!id) throw new Error("NOTION_DATABASE_ID ontbreekt — draai `npm run setup:notion`");
  return id;
}

function headers() {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN ontbreekt");
  return { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" };
}

export type Item = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  colors: string[];
  style: string;
  description: string;
  notes: string;
  projects: string[];
  annotations: Annotation[];
  sourceUrl: string | null;
  notionUrl: string;
  hasImage: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const text = (prop: AnyPage): string =>
  (prop?.rich_text ?? prop?.title ?? []).map((t: AnyPage) => t.plain_text).join("");

const list = (value: string): string[] =>
  value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

function readAnnotations(raw: string): Annotation[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Annotation[]) : [];
  } catch {
    return [];
  }
}

function mapPage(page: AnyPage): Item {
  const props = page.properties ?? {};
  return {
    id: page.id,
    projects: (props[PROPS.projects]?.multi_select ?? []).map((p: AnyPage) => p.name),
    annotations: readAnnotations(text(props[PROPS.annotations])),
    title: text(props[PROPS.title]),
    category: props[PROPS.category]?.select?.name ?? "overig",
    tags: (props[PROPS.tags]?.multi_select ?? []).map((t: AnyPage) => t.name),
    colors: list(text(props[PROPS.colors])),
    style: text(props[PROPS.style]),
    description: text(props[PROPS.description]),
    notes: text(props[PROPS.notes]),
    sourceUrl: props[PROPS.url]?.url ?? null,
    notionUrl: page.url,
    hasImage: (props[PROPS.file]?.files ?? []).length > 0,
    status: props[PROPS.status]?.select?.name ?? "nieuw",
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
  };
}

export async function listItems(): Promise<Item[]> {
  const items: Item[] = [];
  let cursor: string | undefined;

  do {
    const res: AnyPage = await notion().databases.query({
      database_id: databaseId(),
      start_cursor: cursor,
      page_size: 100,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    });
    for (const page of res.results) items.push(mapPage(page));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  return items;
}

export async function getItem(id: string): Promise<Item | null> {
  try {
    const page: AnyPage = await notion().pages.retrieve({ page_id: id });
    return mapPage(page);
  } catch {
    return null;
  }
}

/**
 * Notion-bestands-URLs verlopen na ongeveer een uur, dus we halen hem elke
 * keer vers op in plaats van hem ergens te bewaren.
 */
export async function imageUrl(id: string): Promise<string | null> {
  const page: AnyPage = await notion().pages.retrieve({ page_id: id });
  const file = page.properties?.[PROPS.file]?.files?.[0];
  return file?.file?.url ?? file?.external?.url ?? null;
}

export async function uploadFile(
  data: Buffer,
  fileName: string,
  contentType: string,
): Promise<string> {
  const created = await fetch(`${API}/file_uploads`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ filename: fileName, content_type: contentType }),
  });
  if (!created.ok) {
    throw new Error(`Notion weigerde de upload (${created.status}): ${await created.text()}`);
  }
  const upload: AnyPage = await created.json();

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type: contentType }), fileName);

  const sent = await fetch(`${API}/file_uploads/${upload.id}/send`, {
    method: "POST",
    headers: headers(),
    body: form,
  });
  if (!sent.ok) {
    throw new Error(`Versturen naar Notion mislukt (${sent.status}): ${await sent.text()}`);
  }

  return upload.id;
}

export async function createPage(input: {
  notes: string;
  sourceUrl: string | null;
  fileUploadId: string | null;
  fileName: string | null;
}): Promise<Item> {
  const properties: AnyPage = {
    [PROPS.title]: { title: [{ type: "text", text: { content: "Nieuw item" } }] },
    [PROPS.status]: { select: { name: "nieuw" } },
  };

  if (input.sourceUrl) properties[PROPS.url] = { url: input.sourceUrl };
  if (input.notes) {
    properties[PROPS.notes] = {
      rich_text: [{ type: "text", text: { content: input.notes.slice(0, 2000) } }],
    };
  }
  if (input.fileUploadId) {
    properties[PROPS.file] = {
      files: [
        {
          type: "file_upload",
          file_upload: { id: input.fileUploadId },
          name: input.fileName ?? "upload",
        },
      ],
    };
  }

  const page: AnyPage = await notion().pages.create({
    parent: { database_id: databaseId() },
    properties,
  });
  return mapPage(page);
}

const rich = (value: string) => ({
  rich_text: [{ type: "text", text: { content: value.slice(0, 2000) } }],
});

/** Schrijft het resultaat van de tagger weg. Notion is de enige plek waar dit landt. */
export async function saveTags(
  id: string,
  data: {
    title: string;
    category: string;
    tags: string[];
    colors: string[];
    style: string;
    description: string;
  },
  options: { keepTitle?: boolean } = {},
): Promise<void> {
  const properties: AnyPage = {
    [PROPS.category]: { select: { name: data.category } },
    [PROPS.tags]: { multi_select: data.tags.map((name) => ({ name })) },
    [PROPS.colors]: rich(data.colors.join(", ")),
    [PROPS.style]: rich(data.style),
    [PROPS.description]: rich(data.description),
    [PROPS.status]: { select: { name: "getagd" } },
  };

  if (!options.keepTitle) {
    properties[PROPS.title] = {
      title: [{ type: "text", text: { content: data.title.slice(0, 200) } }],
    };
  }

  await notion().pages.update({ page_id: id, properties });
}

export async function setStatus(id: string, status: string): Promise<void> {
  await notion().pages.update({
    page_id: id,
    properties: { [PROPS.status]: { select: { name: status } } } as AnyPage,
  });
}

export async function attachImage(
  id: string,
  data: Buffer,
  fileName: string,
  contentType: string,
): Promise<void> {
  const uploadId = await uploadFile(data, fileName, contentType);
  await notion().pages.update({
    page_id: id,
    properties: {
      [PROPS.file]: {
        files: [{ type: "file_upload", file_upload: { id: uploadId }, name: fileName }],
      },
    } as AnyPage,
  });
}

/* ── Projecten, aantekeningen en verwijderen ──────────────────────────── */

export async function setProjects(id: string, projects: string[]): Promise<void> {
  await notion().pages.update({
    page_id: id,
    properties: {
      [PROPS.projects]: { multi_select: projects.map((name) => ({ name })) },
    } as AnyPage,
  });
}

/**
 * Notion knipt rich_text in blokken van 2000 tekens. Bij veel aantekeningen
 * splitsen we de JSON, zodat er niets stilletjes wegvalt.
 */
export async function setAnnotations(
  id: string,
  annotations: Annotation[],
): Promise<void> {
  const json = JSON.stringify(annotations);
  const chunks = json.match(/[\s\S]{1,1900}/g) ?? [""];

  await notion().pages.update({
    page_id: id,
    properties: {
      [PROPS.annotations]: {
        rich_text: chunks.map((content) => ({ type: "text", text: { content } })),
      },
    } as AnyPage,
  });
}

/** Archiveren in Notion: uit de vault, maar terug te halen via de prullenbak. */
export async function archiveItem(id: string): Promise<void> {
  await notion().pages.update({ page_id: id, archived: true } as AnyPage);
}

/** Alle projectnamen die de database kent, ook de nog lege. */
export async function listProjects(): Promise<string[]> {
  const db: AnyPage = await notion().databases.retrieve({ database_id: databaseId() });
  const options = db.properties?.[PROPS.projects]?.multi_select?.options ?? [];
  return options.map((option: AnyPage) => option.name as string).sort();
}

export async function createProject(name: string): Promise<void> {
  const db: AnyPage = await notion().databases.retrieve({ database_id: databaseId() });
  const existing = db.properties?.[PROPS.projects]?.multi_select?.options ?? [];
  if (existing.some((option: AnyPage) => option.name === name)) return;

  await notion().databases.update({
    database_id: databaseId(),
    properties: {
      [PROPS.projects]: {
        multi_select: { options: [...existing, { name }] },
      },
    },
  } as AnyPage);
}

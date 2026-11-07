import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Sur Railway le disque du conteneur est effacé à chaque redéploiement : les
// annonces doivent vivre sur le volume. Par défaut, on les range à côté des
// tokens (TOKEN_STORE_PATH), sinon bot/announcements.json en local.
const { ANNOUNCEMENTS_STORE_PATH, TOKEN_STORE_PATH } = process.env;
const FILE_URL =
  ANNOUNCEMENTS_STORE_PATH ||
  (TOKEN_STORE_PATH
    ? join(dirname(TOKEN_STORE_PATH), 'announcements.json')
    : new URL('../announcements.json', import.meta.url));
console.log(`[announcements] stockage : ${FILE_URL instanceof URL ? fileURLToPath(FILE_URL) : FILE_URL}`);

async function readAll() {
  try {
    return JSON.parse(await Bun.file(FILE_URL).text());
  } catch {
    return [];
  }
}

async function writeAll(list) {
  await Bun.write(FILE_URL, JSON.stringify(list, null, 2));
}

export async function listAnnouncements() {
  return readAll();
}

export async function addAnnouncement(text) {
  const list = await readAll();
  const entry = { id: crypto.randomUUID(), text };
  list.push(entry);
  await writeAll(list);
  return entry;
}

export async function updateAnnouncement(id, text) {
  const list = await readAll();
  const entry = list.find((a) => a.id === id);
  if (!entry) return null;
  entry.text = text;
  await writeAll(list);
  return entry;
}

export async function removeAnnouncement(id) {
  const list = await readAll();
  const next = list.filter((a) => a.id !== id);
  const removed = next.length !== list.length;
  if (removed) await writeAll(next);
  return removed;
}

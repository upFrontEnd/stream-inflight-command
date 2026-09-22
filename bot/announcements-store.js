const FILE_URL = new URL('./announcements.json', import.meta.url);

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

export async function removeAnnouncement(id) {
  const list = await readAll();
  const next = list.filter((a) => a.id !== id);
  const removed = next.length !== list.length;
  if (removed) await writeAll(next);
  return removed;
}

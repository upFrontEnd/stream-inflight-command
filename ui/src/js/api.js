const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? 'http://localhost:8787';
// Vide = pas de bot joignable (ex : GitHub Pages). L'onglet Sons bascule alors
// sur la liste publiée avec le site, en lecture seule.
const BOT_URL = import.meta.env.VITE_BOT_URL ?? (import.meta.env.DEV ? 'http://localhost:4242' : '');

function botUrl() {
  if (!BOT_URL) throw new Error('Aucun bot configuré (VITE_BOT_URL)');
  return BOT_URL;
}

export async function fetchPreview() {
  const res = await fetch(`${WORKER_URL}/api/preview`);
  if (!res.ok) {
    throw new Error(`Le worker a répondu ${res.status}`);
  }
  return res.json();
}

// editable : true si le bot répond (ajout de son possible depuis le dashboard),
// false si on lit sounds.json publié avec le site (ajout via GitHub).
export async function fetchSounds() {
  if (BOT_URL) {
    try {
      const res = await fetch(`${BOT_URL}/api/sounds`);
      if (res.ok) return { sounds: await res.json(), editable: true };
    } catch {
      // bot éteint : on retombe sur la liste publiée
    }
  }

  const res = await fetch(`${import.meta.env.BASE_URL}sounds.json`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`sounds.json a répondu ${res.status}`);
  }
  return { sounds: await res.json(), editable: false };
}

export async function uploadSound({ category, command, file }) {
  const form = new FormData();
  form.set('category', category);
  form.set('command', command);
  form.set('file', file);

  const res = await fetch(`${botUrl()}/api/sounds`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Le bot a répondu ${res.status}`);
  }
  return data;
}

export async function fetchAnnouncements() {
  const res = await fetch(`${botUrl()}/api/announcements`);
  if (!res.ok) {
    throw new Error(`Le bot a répondu ${res.status}`);
  }
  return res.json();
}

export async function addAnnouncement(text) {
  const res = await fetch(`${botUrl()}/api/announcements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Le bot a répondu ${res.status}`);
  }
  return data;
}

export async function updateAnnouncement(id, text) {
  const res = await fetch(`${botUrl()}/api/announcements/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Le bot a répondu ${res.status}`);
  }
  return data;
}

export async function deleteAnnouncement(id) {
  const res = await fetch(`${botUrl()}/api/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Le bot a répondu ${res.status}`);
  }
  return res.json();
}

export async function fetchAnnounceSchedule() {
  const res = await fetch(`${botUrl()}/api/announcements/schedule`);
  if (!res.ok) {
    throw new Error(`Le bot a répondu ${res.status}`);
  }
  return res.json();
}

export async function testAnnouncement() {
  const res = await fetch(`${botUrl()}/api/announcements/test`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Le bot a répondu ${res.status}`);
  }
  return data;
}

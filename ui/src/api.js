const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? 'http://localhost:8787';
const BOT_URL = import.meta.env.VITE_BOT_URL ?? 'http://localhost:4242';

export async function fetchPreview() {
  const res = await fetch(`${WORKER_URL}/api/preview`);
  if (!res.ok) {
    throw new Error(`Le worker a répondu ${res.status}`);
  }
  return res.json();
}

export async function fetchSounds() {
  const res = await fetch(`${BOT_URL}/api/sounds`);
  if (!res.ok) {
    throw new Error(`Le bot a répondu ${res.status}`);
  }
  return res.json();
}

export async function uploadSound({ category, command, file }) {
  const form = new FormData();
  form.set('category', category);
  form.set('command', command);
  form.set('file', file);

  const res = await fetch(`${BOT_URL}/api/sounds`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Le bot a répondu ${res.status}`);
  }
  return data;
}

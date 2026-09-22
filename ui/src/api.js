const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? 'http://localhost:8787';

export async function fetchPreview() {
  const res = await fetch(`${WORKER_URL}/api/preview`);
  if (!res.ok) {
    throw new Error(`Le worker a répondu ${res.status}`);
  }
  return res.json();
}

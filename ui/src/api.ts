export interface CommandPreview {
  ok: boolean;
  text: string;
  error?: string;
}

export interface PreviewResponse {
  vol: CommandPreview;
  appareil: CommandPreview;
  plandevol: CommandPreview;
  meteo: CommandPreview;
  raw: unknown;
}

const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? 'http://localhost:8787';

export async function fetchPreview(): Promise<PreviewResponse> {
  const res = await fetch(`${WORKER_URL}/api/preview`);
  if (!res.ok) {
    throw new Error(`Le worker a répondu ${res.status}`);
  }
  return res.json();
}

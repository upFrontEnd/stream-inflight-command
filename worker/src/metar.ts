export interface MetarResult {
  icao: string;
  raw: string | null;
}

export async function fetchMetars(icaoCodes: string[]): Promise<MetarResult[]> {
  const ids = icaoCodes.join(',');
  const res = await fetch(`https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(ids)}&format=json`);

  if (!res.ok) {
    throw new Error(`aviationweather.gov a répondu ${res.status}`);
  }

  const data = (await res.json()) as Array<{ icaoId: string; rawOb: string }>;

  return icaoCodes.map((icao) => {
    const match = data.find((entry) => entry.icaoId === icao);
    return { icao, raw: match?.rawOb ?? null };
  });
}

export function formatMeteoText(metars: MetarResult[]): string {
  return metars
    .map((m) => (m.raw ? `${m.icao}: ${m.raw}` : `${m.icao}: METAR indisponible`))
    .join(' | ');
}

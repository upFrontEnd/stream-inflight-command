export async function fetchMetars(icaoCodes) {
  const ids = icaoCodes.join(',');
  const res = await fetch(`https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(ids)}&format=json`);

  if (!res.ok) {
    throw new Error(`aviationweather.gov a répondu ${res.status}`);
  }

  const data = await res.json();

  return icaoCodes.map((icao) => {
    const match = data.find((entry) => entry.icaoId === icao);
    return { icao, raw: match?.rawOb ?? null };
  });
}

// fetchMetars est toujours appelé avec [origine, destination] (voir index.js)
// : 🟩 marque la provenance, 🟥 la destination.
const ICONS = ['🟩', '🟥'];

export function formatMeteoText(metars) {
  return metars
    .map((m, i) => {
      const icon = ICONS[i] ?? '';
      const text = m.raw ? `${m.icao}: ${m.raw}` : `${m.icao}: METAR indisponible`;
      return icon ? `${icon} ${text}` : text;
    })
    .join(' | ');
}

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

// \n sépare des paragraphes destinés à devenir des messages de chat distincts
// (bot/index.js les envoie un par un) — impossible d'avoir un vrai saut de
// ligne à l'intérieur d'un seul message IRC/Twitch.
export function formatMeteoText(metars) {
  return metars
    .map((m) => (m.raw ? `${m.icao}: ${m.raw}` : `${m.icao}: METAR indisponible`))
    .join('\n');
}

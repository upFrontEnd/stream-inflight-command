// Champs vérifiés contre un appel réel à l'API SimBrief (userid=57166, sept. 2026).
export async function fetchSimbriefData(pilotId) {
  // L'API SimBrief distingue userid (numérique, ex: 57166) et username (texte).
  const param = /^\d+$/.test(pilotId) ? 'userid' : 'username';
  const url = `https://www.simbrief.com/api/xml.fetcher.php?${param}=${encodeURIComponent(pilotId)}&json=1`;
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok || data?.fetch?.status?.startsWith('Error')) {
    const message = data?.fetch?.status?.replace(/^Error:\s*/, '') ?? `SimBrief a répondu ${res.status}`;
    throw new Error(message);
  }

  if (!data?.origin?.icao_code || !data?.destination?.icao_code) {
    throw new Error('Aucun plan de vol SimBrief trouvé pour ce pilote');
  }

  return {
    origin: { icao: data.origin.icao_code, name: data.origin.name ?? '' },
    destination: { icao: data.destination.icao_code, name: data.destination.name ?? '' },
    aircraft: {
      name: data.aircraft?.name ?? 'Appareil inconnu',
      icao: data.aircraft?.icaocode ?? '',
      reg: data.aircraft?.reg ?? '',
    },
    route: data.general?.route ?? '',
    routeDistanceNm: data.general?.route_distance ?? '',
    cruiseAltitudeFt: data.general?.initial_altitude ?? '',
    enrouteSeconds: Number(data.times?.est_time_enroute ?? 0),
    fuelPlanRamp: data.fuel?.plan_ramp ?? '',
    fuelUnits: data.params?.units === 'kgs' ? 'kg' : 'lbs',
  };
}

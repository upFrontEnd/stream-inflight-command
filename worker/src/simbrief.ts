import type { SimbriefData } from './types';

// Champs vérifiés contre des intégrations SimBrief tierces (dispatch tools open-source),
// pas contre un appel réel : à confirmer avec le panneau "données brutes" de l'UI dès
// qu'un vrai username est branché, et ajuster ici si un champ ne correspond pas.
export async function fetchSimbriefData(username: string): Promise<SimbriefData> {
  const url = `https://www.simbrief.com/api/xml.fetcher.php?username=${encodeURIComponent(username)}&json=1`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`SimBrief a répondu ${res.status}`);
  }

  const data = (await res.json()) as any;

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

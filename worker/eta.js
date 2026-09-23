import { fetchVatsimPilot } from './vatsim.js';
import { fetchIvaoPilot } from './ivao.js';

const EARTH_RADIUS_NM = 3440.065;

function haversineNm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(a));
}

// IVAO donne directement la distance restante (lastTrack.arrivalDistance),
// pas besoin de la calculer. VATSIM ne la fournit pas : on la calcule nous-
// mêmes à partir de la position live du pilote et des coordonnées de
// destination du plan SimBrief (déjà récupérées par ailleurs, pas besoin
// d'une base d'aéroports séparée).
export async function findEta(env, destination) {
  const ivao = await fetchIvaoPilot(env.IVAO_VID).catch(() => null);
  if (ivao?.groundspeedKt > 0 && ivao.arrivalDistanceNm != null) {
    return { network: 'IVAO', minutesRemaining: (ivao.arrivalDistanceNm / ivao.groundspeedKt) * 60 };
  }

  const vatsim = await fetchVatsimPilot(env.VATSIM_CID).catch(() => null);
  if (vatsim?.groundspeedKt > 0) {
    const distanceNm = haversineNm(vatsim.lat, vatsim.lon, destination.lat, destination.lon);
    return { network: 'VATSIM', minutesRemaining: (distanceNm / vatsim.groundspeedKt) * 60 };
  }

  return null;
}

function formatClock(minutesFromNow) {
  const eta = new Date(Date.now() + minutesFromNow * 60_000);
  const hh = String(eta.getUTCHours()).padStart(2, '0');
  const mm = String(eta.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}Z`;
}

function formatRemaining(minutesFromNow) {
  const h = Math.floor(minutesFromNow / 60);
  const m = Math.round(minutesFromNow % 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

export function formatEtaText(result, destinationIcao) {
  if (!result) {
    return `🕐 Pas connecté sur IVAO ni VATSIM pour le moment`;
  }
  return `🕐 ETA ${destinationIcao} | ${formatClock(result.minutesRemaining)} | dans ${formatRemaining(result.minutesRemaining)} | via ${result.network}`;
}

// Flux public IVAO (Whazzup v2), sans clé (le token développeur ne sert que
// pour l'accès "division"). Max 1 appel/15s sous peine de ban IP.
// https://wiki.ivao.aero/en/home/devops/api/whazuup/file-format-v2
export async function fetchIvaoPilot(vid) {
  if (!vid) return null;

  const res = await fetch('https://api.ivao.aero/v2/tracker/whazzup');
  if (!res.ok) {
    throw new Error(`IVAO a répondu ${res.status}`);
  }

  const data = await res.json();
  const pilot = data.clients?.pilots?.find((p) => String(p.userId) === String(vid));
  if (!pilot) return null;

  return {
    network: 'IVAO',
    callsign: pilot.callsign,
    lat: pilot.lastTrack?.latitude,
    lon: pilot.lastTrack?.longitude,
    groundspeedKt: pilot.lastTrack?.groundSpeed,
    arrivalDistanceNm: pilot.lastTrack?.arrivalDistance,
  };
}

// Flux public VATSIM, sans clé, mis à jour environ toutes les 15s.
// https://vatsim.dev/api/data-api/get-network-data
export async function fetchVatsimPilot(cid) {
  if (!cid) return null;

  const res = await fetch('https://data.vatsim.net/v3/vatsim-data.json');
  if (!res.ok) {
    throw new Error(`VATSIM a répondu ${res.status}`);
  }

  const data = await res.json();
  const pilot = data.pilots?.find((p) => String(p.cid) === String(cid));
  if (!pilot) return null;

  return {
    network: 'VATSIM',
    callsign: pilot.callsign,
    lat: pilot.latitude,
    lon: pilot.longitude,
    groundspeedKt: pilot.groundspeed,
  };
}

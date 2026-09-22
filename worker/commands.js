export function formatVol(d) {
  return `✈️ ${d.origin.icao} (${d.origin.name}) → ${d.destination.icao} (${d.destination.name}) | Route: ${d.route || 'directe'} | ${d.routeDistanceNm} nm`;
}

export function formatAppareil(d) {
  return `🛩️ ${d.aircraft.name} (${d.aircraft.icao}) — immat. ${d.aircraft.reg}`;
}

// \n sépare des paragraphes destinés à devenir des messages de chat distincts
// (bot/index.js les envoie un par un) — impossible d'avoir un vrai saut de
// ligne à l'intérieur d'un seul message IRC/Twitch.
export function formatPlandevol(d) {
  const fl = Math.round(Number(d.cruiseAltitudeFt) / 100);
  const resume = `📋 ${d.origin.icao} → ${d.destination.icao} | FL${fl} | ${formatDuration(d.enrouteSeconds)} | ${d.fuelPlanRamp} ${d.fuelUnits} de carburant prévu`;
  const header = `✈️ ${d.origin.icao} (${d.origin.name}) → ${d.destination.icao} (${d.destination.name}) |`;
  const route = `Route: ${d.route || 'directe'} | ${d.routeDistanceNm} nm`;
  return [resume, header, route].join('\n');
}

function formatDuration(seconds) {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

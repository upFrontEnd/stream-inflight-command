export function formatVol(d) {
  return `✈️ ${d.origin.icao} (${d.origin.name}) → ${d.destination.icao} (${d.destination.name}) | Route: ${d.route || 'directe'} | ${d.routeDistanceNm} nm`;
}

export function formatAppareil(d) {
  return `🛩️ ${d.aircraft.name} (${d.aircraft.icao}) — immat. ${d.aircraft.reg}`;
}

// Convention à deux niveaux pour bot/index.js (sayLines) : "\n\n" sépare des
// paragraphes (une ligne vide s'affiche entre eux dans le chat), un simple
// "\n" sépare juste deux messages consécutifs collés (pas de ligne vide).
// Impossible d'avoir un vrai saut de ligne à l'intérieur d'un seul message
// IRC/Twitch, donc chaque ligne devient de toute façon un message à part.
export function formatPlandevol(d) {
  const fl = Math.round(Number(d.cruiseAltitudeFt) / 100);
  const resume = `📋 ${d.origin.icao} → ${d.destination.icao} | FL${fl} | ${formatDuration(d.enrouteSeconds)} | ${d.fuelPlanRamp} ${d.fuelUnits} de carburant prévu`;
  const originLine = `✈️ ${d.origin.icao} (${d.origin.name})`;
  const destLine = `→ ${d.destination.icao} (${d.destination.name}) |`;
  const route = `Route: ${d.route || 'directe'} | ${d.routeDistanceNm} nm`;
  return [resume, `${originLine}\n${destLine}`, route].join('\n\n');
}

function formatDuration(seconds) {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

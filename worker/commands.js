export function formatVol(d) {
  return `✈️ ${d.origin.icao} (${d.origin.name}) → ${d.destination.icao} (${d.destination.name}) | Route: ${d.route || 'directe'} | ${d.routeDistanceNm} nm`;
}

export function formatAppareil(d) {
  return `🛩️ ${d.aircraft.name} (${d.aircraft.icao}) — immat. ${d.aircraft.reg}`;
}

// Espace insécable (U+00A0), pas un espace normal : le rendu HTML du chat
// Twitch fusionne les espaces classiques consécutifs en un seul, ce qui
// annulerait l'écart visuel recherché ici. Un seul message de chat (Twitch ne
// supporte aucun vrai retour à la ligne).
const SECTION_GAP = '    ';

export function formatPlandevol(d) {
  const fl = Math.round(Number(d.cruiseAltitudeFt) / 100);
  const resume = `📋 ${d.origin.icao} → ${d.destination.icao} | FL${fl} | ${formatDuration(d.enrouteSeconds)} | ${d.fuelPlanRamp} ${d.fuelUnits} de carburant prévu`;
  return `${resume}${SECTION_GAP}${formatVol(d)}`;
}

function formatDuration(seconds) {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

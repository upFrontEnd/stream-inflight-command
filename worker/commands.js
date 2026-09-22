export function formatVol(d) {
  const fl = Math.round(Number(d.cruiseAltitudeFt) / 100);
  return `📋 ${d.origin.icao} → ${d.destination.icao} | FL${fl} | ${formatDuration(d.enrouteSeconds)} | ${d.fuelPlanRamp} ${d.fuelUnits} de carburant prévu`;
}

export function formatAppareil(d) {
  return `🛩️ ${d.aircraft.name} (${d.aircraft.icao}) | immat. ${d.aircraft.reg}`;
}

export function formatPlandevol(d) {
  return `✈️ ${d.origin.icao} (${d.origin.name}) → ${d.destination.icao} (${d.destination.name}) | Route: ${d.route || 'directe'} | ${d.routeDistanceNm} nm`;
}

function formatDuration(seconds) {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

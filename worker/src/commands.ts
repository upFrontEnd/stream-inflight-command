import type { SimbriefData } from './types';

export function formatVol(d: SimbriefData): string {
  return `✈️ ${d.origin.icao} (${d.origin.name}) → ${d.destination.icao} (${d.destination.name}) | Route: ${d.route || 'directe'} | ${d.routeDistanceNm} nm`;
}

export function formatAppareil(d: SimbriefData): string {
  return `🛩️ ${d.aircraft.name} (${d.aircraft.icao}) — immat. ${d.aircraft.reg}`;
}

export function formatPlandevol(d: SimbriefData): string {
  const fl = Math.round(Number(d.cruiseAltitudeFt) / 100);
  return `📋 ${d.origin.icao} → ${d.destination.icao} | FL${fl} | ${formatDuration(d.enrouteSeconds)} | ${d.fuelPlanRamp} ${d.fuelUnits} de carburant prévu`;
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

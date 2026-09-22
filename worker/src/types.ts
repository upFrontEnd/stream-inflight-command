export interface Env {
  SIMBRIEF_USERNAME: string;
}

export interface SimbriefData {
  origin: { icao: string; name: string };
  destination: { icao: string; name: string };
  aircraft: { name: string; icao: string; reg: string };
  route: string;
  routeDistanceNm: string;
  cruiseAltitudeFt: string;
  enrouteSeconds: number;
  fuelPlanRamp: string;
  fuelUnits: string;
}

export interface CommandPreview {
  ok: boolean;
  text: string;
  error?: string;
}

export interface PreviewResponse {
  vol: CommandPreview;
  appareil: CommandPreview;
  plandevol: CommandPreview;
  meteo: CommandPreview;
  raw: SimbriefData | null;
}

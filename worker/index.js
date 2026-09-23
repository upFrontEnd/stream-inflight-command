import { fetchSimbriefData } from './simbrief.js';
import { fetchMetars, formatMeteoText } from './metar.js';
import { formatVol, formatAppareil, formatPlandevol } from './commands.js';
import { findEta, formatEtaText } from './eta.js';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
};

function textResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...CORS_HEADERS },
  });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

function errorMessage(err) {
  return err instanceof Error ? err.message : 'Erreur inconnue';
}

async function buildPreview(env) {
  let simbrief;
  try {
    simbrief = await fetchSimbriefData(env.SIMBRIEF_USERNAME);
  } catch (err) {
    const failed = { ok: false, text: `Erreur : ${errorMessage(err)}`, error: errorMessage(err) };
    return { vol: failed, appareil: failed, plandevol: failed, meteo: failed, eta: failed, raw: null };
  }

  const vol = { ok: true, text: formatVol(simbrief) };
  const appareil = { ok: true, text: formatAppareil(simbrief) };
  const plandevol = { ok: true, text: formatPlandevol(simbrief) };

  let meteo;
  try {
    const metars = await fetchMetars([simbrief.origin.icao, simbrief.destination.icao]);
    meteo = { ok: true, text: formatMeteoText(metars) };
  } catch (err) {
    meteo = { ok: false, text: `Erreur : ${errorMessage(err)}`, error: errorMessage(err) };
  }

  let eta;
  try {
    const result = await findEta(env, simbrief.destination);
    eta = { ok: true, text: formatEtaText(result, simbrief.destination.icao) };
  } catch (err) {
    eta = { ok: false, text: `Erreur : ${errorMessage(err)}`, error: errorMessage(err) };
  }

  return { vol, appareil, plandevol, meteo, eta, raw: simbrief };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/preview') {
      return jsonResponse(await buildPreview(env));
    }

    if (!env.SIMBRIEF_USERNAME) {
      return textResponse('Erreur : SIMBRIEF_USERNAME non configuré');
    }

    try {
      if (url.pathname === '/vol' || url.pathname === '/appareil' || url.pathname === '/plandevol') {
        const simbrief = await fetchSimbriefData(env.SIMBRIEF_USERNAME);
        if (url.pathname === '/vol') return textResponse(formatVol(simbrief));
        if (url.pathname === '/appareil') return textResponse(formatAppareil(simbrief));
        return textResponse(formatPlandevol(simbrief));
      }

      if (url.pathname === '/meteo') {
        const simbrief = await fetchSimbriefData(env.SIMBRIEF_USERNAME);
        const metars = await fetchMetars([simbrief.origin.icao, simbrief.destination.icao]);
        return textResponse(formatMeteoText(metars));
      }

      if (url.pathname === '/eta') {
        const simbrief = await fetchSimbriefData(env.SIMBRIEF_USERNAME);
        const result = await findEta(env, simbrief.destination);
        return textResponse(formatEtaText(result, simbrief.destination.icao));
      }
    } catch (err) {
      return textResponse(`Erreur : ${errorMessage(err)}`);
    }

    return textResponse('Not found', 404);
  },
};

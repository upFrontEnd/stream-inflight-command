import { fetchSimbriefData } from './simbrief.js';
import { fetchMetars, formatMeteoText } from './metar.js';
import { formatAppareil, formatPlandevol } from './commands.js';

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
    return { appareil: failed, plandevol: failed, meteo: failed, raw: null };
  }

  const appareil = { ok: true, text: formatAppareil(simbrief) };
  const plandevol = { ok: true, text: formatPlandevol(simbrief) };

  let meteo;
  try {
    const metars = await fetchMetars([simbrief.origin.icao, simbrief.destination.icao]);
    meteo = { ok: true, text: formatMeteoText(metars) };
  } catch (err) {
    meteo = { ok: false, text: `Erreur : ${errorMessage(err)}`, error: errorMessage(err) };
  }

  return { appareil, plandevol, meteo, raw: simbrief };
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
      if (url.pathname === '/appareil' || url.pathname === '/plandevol') {
        const simbrief = await fetchSimbriefData(env.SIMBRIEF_USERNAME);
        if (url.pathname === '/appareil') return textResponse(formatAppareil(simbrief));
        return textResponse(formatPlandevol(simbrief));
      }

      if (url.pathname === '/meteo') {
        const simbrief = await fetchSimbriefData(env.SIMBRIEF_USERNAME);
        const metars = await fetchMetars([simbrief.origin.icao, simbrief.destination.icao]);
        return textResponse(formatMeteoText(metars));
      }
    } catch (err) {
      return textResponse(`Erreur : ${errorMessage(err)}`);
    }

    return textResponse('Not found', 404);
  },
};

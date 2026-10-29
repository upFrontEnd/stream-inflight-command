import { readFile, writeFile } from 'node:fs/promises';

// Les access tokens Twitch (Device Code Flow) expirent au bout de 4h. Le
// refresh token, lui, est valable 30 jours tant qu'il est utilisé, mais il est
// à usage unique : Twitch en renvoie un nouveau à chaque refresh, qu'il faut
// repersister pour survivre à un redémarrage.
const ENV_PATH = new URL('../.env', import.meta.url);
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const VALIDATE_URL = 'https://id.twitch.tv/oauth2/validate';
const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';
const REFRESH_MARGIN_SECONDS = 30 * 60;

async function refreshAccessToken({ clientId, refreshToken }) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Refresh du token Twitch refusé : ${data.message ?? res.status}`);
  }
  return data; // { access_token, refresh_token, expires_in, ... }
}

async function validateAccessToken(token) {
  const res = await fetch(VALIDATE_URL, {
    headers: { Authorization: `OAuth ${token.replace(/^oauth:/, '')}` },
  });
  return res.ok ? res.json() : null; // { expires_in, ... } ou null si invalide/expiré
}

async function rotateTokens({ clientId }) {
  const refreshed = await refreshAccessToken({ clientId, refreshToken: process.env.TWITCH_REFRESH_TOKEN });
  process.env.TWITCH_OAUTH_TOKEN = `oauth:${refreshed.access_token}`;
  process.env.TWITCH_REFRESH_TOKEN = refreshed.refresh_token;

  try {
    await persistTokens({ accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token });
  } catch (err) {
    console.error(
      '[auth] ⚠️ tokens rafraîchis mais NON persistés, le prochain redémarrage échouera (relancer bun run bot:token) :',
      err.message,
    );
  }
  return refreshed;
}

// Au démarrage, le token stocké peut avoir expiré (redémarrage/redéploiement
// plus de 4h après le dernier refresh) : on le vérifie et on ne consomme le
// refresh token que si c'est nécessaire. Renvoie la durée de validité restante.
export async function ensureFreshToken({ clientId }) {
  const info = await validateAccessToken(process.env.TWITCH_OAUTH_TOKEN);
  if (info && info.expires_in > REFRESH_MARGIN_SECONDS) return info.expires_in;

  console.log(info ? '[auth] token bientôt expiré, rafraîchissement...' : '[auth] token expiré, rafraîchissement...');
  const refreshed = await rotateTokens({ clientId });
  console.log('[auth] token Twitch rafraîchi au démarrage');
  return refreshed.expires_in;
}

// Réécrit bot/.env localement, ou met à jour les variables Railway via l'API
// quand on tourne sur Railway.
export async function persistTokens({ accessToken, refreshToken }) {
  const { RAILWAY_TOKEN, RAILWAY_PROJECT_ID, RAILWAY_SERVICE_ID, RAILWAY_ENVIRONMENT_ID } = process.env;
  if (RAILWAY_TOKEN && RAILWAY_PROJECT_ID && RAILWAY_SERVICE_ID && RAILWAY_ENVIRONMENT_ID) {
    // Une seule mutation pour les deux tokens, et skipDeploys sinon Railway
    // redéploie le service à chaque changement de variable.
    await railwayRequest({
      query: `mutation($input: VariableCollectionUpsertInput!) { variableCollectionUpsert(input: $input) }`,
      variables: {
        input: {
          projectId: RAILWAY_PROJECT_ID,
          environmentId: RAILWAY_ENVIRONMENT_ID,
          serviceId: RAILWAY_SERVICE_ID,
          variables: {
            TWITCH_OAUTH_TOKEN: `oauth:${accessToken}`,
            TWITCH_REFRESH_TOKEN: refreshToken,
          },
          skipDeploys: true,
        },
      },
    });
    console.log('[railway] tokens Twitch persistés');
    return;
  }

  if (process.env.RAILWAY_ENVIRONMENT_ID) {
    throw new Error('RAILWAY_TOKEN manquant : impossible de persister les tokens sur Railway');
  }

  let content = '';
  try {
    content = await readFile(ENV_PATH, 'utf8');
  } catch {
    content = '';
  }

  content = setEnvVar(content, 'TWITCH_OAUTH_TOKEN', `oauth:${accessToken}`);
  content = setEnvVar(content, 'TWITCH_REFRESH_TOKEN', refreshToken);

  await writeFile(ENV_PATH, content, 'utf8');
}

// RAILWAY_TOKEN peut être un token de compte/équipe (en-tête Bearer) ou un
// token de projet (en-tête Project-Access-Token) : on essaie les deux.
async function railwayRequest(body) {
  const token = process.env.RAILWAY_TOKEN;
  const authHeaders = [{ Authorization: `Bearer ${token}` }, { 'Project-Access-Token': token }];
  let lastError;

  for (const headers of authHeaders) {
    const res = await fetch(RAILWAY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && !data.errors) return data;
    lastError = JSON.stringify(data.errors ?? res.status);
  }

  throw new Error(`Railway API : ${lastError}`);
}

function setEnvVar(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) return content.replace(pattern, line);

  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  return `${content}${separator}${line}\n`;
}

// Rafraîchit l'access token 30 min avant son expiration et reconnecte le
// client tmi.js avec le nouveau. En cas d'échec, nouvel essai 5 min plus tard.
export function scheduleAutoRefresh(client, { clientId, expiresInSeconds }) {
  const schedule = (seconds) => setTimeout(run, Math.max(seconds - REFRESH_MARGIN_SECONDS, 60) * 1000);

  async function run() {
    try {
      const refreshed = await rotateTokens({ clientId });
      client.opts.identity.password = `oauth:${refreshed.access_token}`;
      await client.disconnect();
      await client.connect();
      console.log('[auth] token Twitch rafraîchi automatiquement, reconnecté au chat');
      schedule(refreshed.expires_in);
    } catch (err) {
      console.error('[auth] échec du refresh automatique, nouvel essai dans 5 min :', err.message);
      schedule(REFRESH_MARGIN_SECONDS + 5 * 60);
    }
  }

  schedule(expiresInSeconds);
}

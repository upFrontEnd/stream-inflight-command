import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// Access token : 4h. Refresh token : sans expiration pour une appli Twitch
// "Confidential" (TWITCH_CLIENT_SECRET défini), 30 jours pour une appli
// "Public". Twitch peut renvoyer un nouveau refresh token à chaque refresh, il
// faut donc toujours stocker le dernier.
//
// En dernier recours (refresh token révoqué/expiré), le bot ne plante plus :
// il lance lui-même l'autorisation Twitch et affiche le lien sur /auth, un
// clic suffit, sans recopier aucun token nulle part.
const ENV_PATH = new URL('../.env', import.meta.url);
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const DEVICE_URL = 'https://id.twitch.tv/oauth2/device';
const VALIDATE_URL = 'https://id.twitch.tv/oauth2/validate';
const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';
const SCOPES = 'chat:read chat:edit';
const REFRESH_MARGIN_SECONDS = 30 * 60;

// Fichier de stockage des tokens, à placer sur un volume Railway (ex :
// /data/twitch-tokens.json) pour qu'il survive aux redéploiements.
const TOKEN_FILE = process.env.TOKEN_STORE_PATH;

let pendingAuth = null;

export function getPendingAuth() {
  return pendingAuth;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withSecret(params) {
  if (process.env.TWITCH_CLIENT_SECRET) params.client_secret = process.env.TWITCH_CLIENT_SECRET;
  return new URLSearchParams(params);
}

export async function loadStoredTokens() {
  if (!TOKEN_FILE) return;
  try {
    const { accessToken, refreshToken } = JSON.parse(await readFile(TOKEN_FILE, 'utf8'));
    process.env.TWITCH_OAUTH_TOKEN = `oauth:${accessToken}`;
    process.env.TWITCH_REFRESH_TOKEN = refreshToken;
    console.log(`[auth] tokens chargés depuis ${TOKEN_FILE}`);
  } catch {
    // pas encore de fichier : on part des variables d'environnement
  }
}

async function refreshAccessToken({ clientId, refreshToken }) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: withSecret({ client_id: clientId, refresh_token: refreshToken, grant_type: 'refresh_token' }),
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

async function storeTokens(token) {
  process.env.TWITCH_OAUTH_TOKEN = `oauth:${token.access_token}`;
  process.env.TWITCH_REFRESH_TOKEN = token.refresh_token;
  try {
    await persistTokens({ accessToken: token.access_token, refreshToken: token.refresh_token });
  } catch (err) {
    console.error('[auth] ⚠️ tokens obtenus mais NON persistés :', err.message);
  }
}

async function pollDeviceToken({ clientId, deviceCode, interval, expiresAt }) {
  let wait = interval;
  while (Date.now() < expiresAt) {
    await sleep(wait * 1000);
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: withSecret({
        client_id: clientId,
        scopes: SCOPES,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const data = await res.json();

    if (res.ok) return data;
    if (data.message === 'authorization_pending') continue;
    if (data.message === 'slow_down') {
      wait += 5;
      continue;
    }
    console.error(`[auth] autorisation Twitch : ${data.message ?? res.status}, nouveau code...`);
    return null;
  }
  return null; // code expiré
}

// Device Code Flow : attend que l'utilisateur valide sur Twitch, en
// régénérant un code tant que ce n'est pas fait.
export async function authorizeDevice({ clientId, onCode }) {
  for (;;) {
    const res = await fetch(DEVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, scopes: SCOPES }),
    });
    if (!res.ok) {
      throw new Error(`Demande de device code refusée : ${res.status} ${await res.text()}`);
    }
    const { device_code, user_code, verification_uri, interval = 5, expires_in = 1800 } = await res.json();
    onCode({ verificationUri: verification_uri, userCode: user_code });

    const token = await pollDeviceToken({
      clientId,
      deviceCode: device_code,
      interval,
      expiresAt: Date.now() + expires_in * 1000,
    });
    if (token) {
      await storeTokens(token);
      return token;
    }
  }
}

async function reauthorize({ clientId }) {
  const token = await authorizeDevice({
    clientId,
    onCode: ({ verificationUri, userCode }) => {
      pendingAuth = { verificationUri, userCode };
      console.log(`[auth] ⚠️ autorisation Twitch requise : ouvre ${verificationUri} (code ${userCode}), lien aussi dispo sur /auth`);
    },
  });
  pendingAuth = null;
  console.log('[auth] ✅ autorisation Twitch obtenue');
  return token;
}

// Garantit un access token valide : le garde s'il l'est encore, sinon le
// rafraîchit, sinon redemande une autorisation (sans jamais planter).
// Renvoie la durée de validité restante en secondes.
export async function ensureValidToken({ clientId, force = false }) {
  if (!force && process.env.TWITCH_OAUTH_TOKEN) {
    const info = await validateAccessToken(process.env.TWITCH_OAUTH_TOKEN);
    if (info && info.expires_in > REFRESH_MARGIN_SECONDS) return info.expires_in;
  }

  if (process.env.TWITCH_REFRESH_TOKEN) {
    try {
      const refreshed = await refreshAccessToken({ clientId, refreshToken: process.env.TWITCH_REFRESH_TOKEN });
      await storeTokens(refreshed);
      console.log('[auth] token Twitch rafraîchi');
      return refreshed.expires_in;
    } catch (err) {
      console.error('[auth] refresh impossible :', err.message);
    }
  }

  const token = await reauthorize({ clientId });
  return token.expires_in;
}

// Ordre de stockage : fichier (volume Railway) si TOKEN_STORE_PATH est
// défini, variables Railway si l'API est configurée, sinon bot/.env en local.
export async function persistTokens({ accessToken, refreshToken }) {
  if (TOKEN_FILE) {
    await mkdir(dirname(TOKEN_FILE), { recursive: true });
    await writeFile(TOKEN_FILE, JSON.stringify({ accessToken, refreshToken }), 'utf8');
    return;
  }

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

  if (RAILWAY_ENVIRONMENT_ID) {
    throw new Error('ni TOKEN_STORE_PATH ni RAILWAY_TOKEN définis : impossible de persister les tokens sur Railway');
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

// Renouvelle le token 30 min avant son expiration et reconnecte le client
// tmi.js. Si le refresh échoue, ensureValidToken bascule sur une nouvelle
// autorisation : le chat reste connecté en attendant.
export function scheduleAutoRefresh(client, { clientId, expiresInSeconds }) {
  const schedule = (seconds) => setTimeout(run, Math.max(seconds - REFRESH_MARGIN_SECONDS, 60) * 1000);

  async function run() {
    try {
      const expiresIn = await ensureValidToken({ clientId, force: true });
      client.opts.identity.password = process.env.TWITCH_OAUTH_TOKEN;
      await client.disconnect();
      await client.connect();
      console.log('[auth] reconnecté au chat avec le nouveau token');
      schedule(expiresIn);
    } catch (err) {
      console.error('[auth] échec du renouvellement, nouvel essai dans 5 min :', err.message);
      schedule(REFRESH_MARGIN_SECONDS + 5 * 60);
    }
  }

  schedule(expiresInSeconds);
}

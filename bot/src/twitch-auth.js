import { readFile, writeFile } from 'node:fs/promises';

// Les access tokens Twitch (Device Code Flow) n'expirent pas au bout de
// quelques semaines mais au bout de 4h (documenté par Twitch). Sans
// rafraîchissement automatique via le refresh token, le bot planterait
// plusieurs fois par live. Le refresh token, lui, est valable 30 jours tant
// qu'il est utilisé, et Twitch en renvoie un nouveau à chaque refresh (usage
// unique : il faut le repersister à chaque fois pour survivre à un restart).
const ENV_PATH = new URL('../.env', import.meta.url);
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

export async function refreshAccessToken({ clientId, refreshToken }) {
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

// Réécrit bot/.env avec les tokens à jour, en conservant le reste du fichier
// (autres variables, ordre) tel quel.
export async function persistTokens({ accessToken, refreshToken }) {
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

function setEnvVar(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) return content.replace(pattern, line);

  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  return `${content}${separator}${line}\n`;
}

// Rafraîchit périodiquement l'access token en tâche de fond et reconnecte le
// client tmi.js avec le nouveau, sans jamais redemander de login Twitch (sauf
// si le refresh token lui-même a expiré, ce qui suppose 30 jours sans que le
// bot ait tourné).
export function scheduleAutoRefresh(client, { clientId, intervalMs = 3 * 60 * 60 * 1000 }) {
  return setInterval(async () => {
    const refreshToken = process.env.TWITCH_REFRESH_TOKEN;
    if (!refreshToken) return;

    try {
      const refreshed = await refreshAccessToken({ clientId, refreshToken });
      process.env.TWITCH_REFRESH_TOKEN = refreshed.refresh_token;
      await persistTokens({ accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token });

      client.opts.identity.password = `oauth:${refreshed.access_token}`;
      await client.disconnect();
      await client.connect();

      console.log('[auth] token Twitch rafraîchi automatiquement, reconnecté au chat');
    } catch (err) {
      console.error('[auth] échec du refresh automatique périodique :', err.message);
    }
  }, intervalMs);
}

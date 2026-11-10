// Annonces automatiques sans bot, lancé par GitHub Actions toutes les 5 min
// (.github/workflows/announce.yml). Même comportement que le bot :
// - rien n'est envoyé hors live ;
// - un message toutes les ANNOUNCE_INTERVAL_MINUTES une fois le live lancé ;
// - les messages de bot/announcements.json tournent dans l'ordre.
//
// Envoi via l'API Helix avec un token d'application (Client ID + secret) :
// il se régénère à chaque exécution, aucun token utilisateur à faire
// expirer/rafraîchir. Il faut seulement que le compte de la chaîne ait
// autorisé l'appli une fois (lien affiché dans les logs si ce n'est pas fait).
//
// Mode test (FORCE=true, bouton "Run workflow") : envoie le prochain message
// tout de suite, live ou pas, sans décaler le minutage.
import { readFile, writeFile } from 'node:fs/promises';

const {
  TWITCH_CLIENT_ID: CLIENT_ID,
  TWITCH_CLIENT_SECRET: CLIENT_SECRET,
  TWITCH_CHANNEL,
  ANNOUNCE_INTERVAL_MINUTES,
  STATE_PATH = 'announce-state.json',
  FORCE,
} = process.env;

const CHANNEL = (TWITCH_CHANNEL || '').trim().toLowerCase();
const INTERVAL_MS = Number(ANNOUNCE_INTERVAL_MINUTES || 30) * 60_000;
const ANNOUNCEMENTS_PATH = new URL('../bot/announcements.json', import.meta.url);
const SCOPES = 'user:write:chat user:bot channel:bot';
const isTest = FORCE === 'true';

if (!CLIENT_ID || !CLIENT_SECRET || !CHANNEL) {
  console.error('TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET (secrets) et TWITCH_CHANNEL sont requis.');
  process.exit(1);
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function getAppToken() {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'client_credentials' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`token d'application refusé : ${JSON.stringify(data)}`);
  return data.access_token;
}

async function helix(token, path, init = {}) {
  const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
    ...init,
    headers: { 'Client-Id': CLIENT_ID, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function authorizeUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: 'http://localhost',
    response_type: 'token',
    scope: SCOPES,
  });
  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

const state = await readJson(STATE_PATH, {});
const list = (await readJson(ANNOUNCEMENTS_PATH, [])).filter((a) => a?.text?.trim());

if (list.length === 0) {
  console.log('Aucune annonce dans bot/announcements.json, rien à faire.');
  process.exit(0);
}

const token = await getAppToken();

const users = await helix(token, `users?login=${encodeURIComponent(CHANNEL)}`);
const broadcasterId = users.data.data?.[0]?.id;
if (!broadcasterId) throw new Error(`chaîne "${CHANNEL}" introuvable`);

let slot = null;
let startedAt = null;

if (!isTest) {
  const streams = await helix(token, `streams?user_id=${broadcasterId}`);
  const stream = streams.data.data?.[0];
  if (!stream) {
    console.log('⚫ Hors live : aucune annonce envoyée.');
    process.exit(0);
  }

  // Le créneau n°k commence k intervalles après le début du live. Un seul
  // message par créneau : si GitHub retarde une exécution, on ne rattrape pas
  // plusieurs créneaux d'un coup.
  startedAt = stream.started_at;
  slot = Math.floor((Date.now() - Date.parse(startedAt)) / INTERVAL_MS);
  const alreadySent = state.streamStartedAt === startedAt && state.lastSlot >= slot;
  if (slot < 1 || alreadySent) {
    const nextIn = Math.ceil(((slot + 1) * INTERVAL_MS - (Date.now() - Date.parse(startedAt))) / 60_000);
    console.log(`🔴 En live, prochaine annonce dans ~${nextIn} min.`);
    process.exit(0);
  }
}

const index = (state.nextIndex ?? 0) % list.length;
const entry = list[index];

const sent = await helix(token, 'chat/messages', {
  method: 'POST',
  body: JSON.stringify({ broadcaster_id: broadcasterId, sender_id: broadcasterId, message: entry.text }),
});
const result = sent.data.data?.[0];

if (!sent.ok || !result?.is_sent) {
  console.error(`Envoi refusé (${sent.status}) :`, JSON.stringify(sent.data));
  if (sent.status === 401 || sent.status === 403) {
    console.error(`\nAutorisation manquante : connecte-toi avec le compte "${CHANNEL}" et ouvre une fois ce lien :\n${authorizeUrl()}\n(la redirection vers localhost qui échoue ensuite est normale)`);
  }
  process.exit(1);
}

console.log(`✅ Envoyé${isTest ? ' (test)' : ''} : "${entry.text}"`);

state.nextIndex = index + 1;
if (!isTest) {
  state.streamStartedAt = startedAt;
  state.lastSlot = slot;
}
await writeFile(STATE_PATH, JSON.stringify(state), 'utf8');

// Le workflow ne sauvegarde l'état que si un message est parti.
if (process.env.GITHUB_OUTPUT) {
  await writeFile(process.env.GITHUB_OUTPUT, 'sent=true\n', { flag: 'a' });
}

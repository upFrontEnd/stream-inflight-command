import { connectToChat, getUserRole } from './twitch-chat.js';

// Overlay sons autonome (Browser Source OBS) : lit le chat Twitch en anonyme
// et joue les sons publiés avec le site, sans bot ni serveur.
//
// Réglages via l'URL, ex : overlay.html?channel=skyflyeraviation&volume=80&cooldown=10
//   channel  : chaîne Twitch à écouter (par défaut VITE_TWITCH_CHANNEL)
//   volume   : 0 à 100 (100 par défaut)
//   cooldown : secondes entre deux sons, modos exemptés (10 par défaut)

const BASE = import.meta.env.BASE_URL;
const params = new URLSearchParams(location.search);

const CHANNEL = (params.get('channel') ?? import.meta.env.VITE_TWITCH_CHANNEL ?? '').trim().toLowerCase().replace(/^#/, '');
const VOLUME = Math.min(1, Math.max(0, Number(params.get('volume') ?? 100) / 100));
const COOLDOWN_MS = Number(params.get('cooldown') ?? 10) * 1000;
const MANIFEST_REFRESH_MS = 5 * 60_000;

const ROLE_BY_FOLDER = { all: 'viewer', sub: 'subscriber', modo: 'moderator' };
const ROLE_RANK = { viewer: 0, subscriber: 1, moderator: 2 };
const STORAGE_KEY = 'stream-sounds-enabled';

const unlockEl = document.querySelector('#unlock');
const statusEl = document.querySelector('#status');

// OBS met "OBS/x.x.x" dans le user agent de ses Browser Sources et n'y applique
// pas la restriction autoplay : rien ne doit apparaître à l'écran du stream.
if (/\bOBS\//.test(navigator.userAgent)) {
  unlockEl?.remove();
} else {
  unlockEl?.addEventListener('click', () => unlockEl.classList.add('is-unlocked'), { once: true });
}

let commands = {};
let lastSoundAt = 0;
let chatStatus = 'connexion…';
let enabled = readEnabled();

// L'état on/off survit à un rechargement de la source OBS.
function readEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function setEnabled(value) {
  enabled = value;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {}
  console.log(`[overlay] sons ${value ? 'activés' : 'désactivés'}`);
  renderStatus();
}

function renderStatus() {
  if (!statusEl) return;
  statusEl.textContent = CHANNEL
    ? `#${CHANNEL} · ${chatStatus} · ${Object.keys(commands).length} sons · ${enabled ? '🔊 activés' : '🔇 désactivés'}`
    : 'Aucune chaîne : ajoute ?channel=ta_chaine à l\'URL';
}

// Même règle que bot/src/load-commands.js : le nom du fichier est la commande,
// le dossier fixe le rôle minimum.
async function loadCommands() {
  const res = await fetch(`${BASE}sounds.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`sounds.json a répondu ${res.status}`);
  const manifest = await res.json();

  const next = {};
  for (const [folder, minRole] of Object.entries(ROLE_BY_FOLDER)) {
    for (const file of manifest[folder] ?? []) {
      const name = file.slice(0, file.lastIndexOf('.')).toLowerCase();
      const command = name.startsWith('!') ? name : `!${name}`;
      next[command] = { url: `${BASE}sounds/${folder}/${encodeURIComponent(file)}`, minRole };
    }
  }
  commands = next;
  renderStatus();
}

function refreshCommands() {
  loadCommands().catch((err) => console.error('[overlay] chargement des sons impossible :', err));
}

function play(url) {
  const audio = new Audio(url);
  audio.volume = VOLUME;
  audio.play().catch((err) => console.error('[overlay] lecture impossible :', url, err));
}

function handleMessage({ text, tags }) {
  const message = text.trim().toLowerCase();
  const role = getUserRole(tags);

  // !sons on / !sons off : réservé aux modos et au streamer.
  const toggle = message.match(/^!sons\s+(on|off)$/);
  if (toggle) {
    if (role === 'moderator') setEnabled(toggle[1] === 'on');
    return;
  }

  if (!enabled) return;

  const sound = commands[message];
  if (!sound) return;
  if (ROLE_RANK[role] < ROLE_RANK[sound.minRole]) return;

  const isExempt = role === 'moderator';
  if (!isExempt && Date.now() - lastSoundAt < COOLDOWN_MS) return;

  lastSoundAt = Date.now();
  console.log(`[overlay] ${message} (${tags['display-name']})`);
  play(sound.url);
}

renderStatus();
refreshCommands();
// Un son ajouté sur GitHub arrive sans recharger la source OBS.
setInterval(refreshCommands, MANIFEST_REFRESH_MS);

if (CHANNEL) {
  connectToChat(CHANNEL, {
    onMessage: handleMessage,
    onStatus: (status) => {
      chatStatus = status === 'connected' ? 'connecté' : 'reconnexion…';
      renderStatus();
    },
  });
}

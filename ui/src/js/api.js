import {
  getGithubToken,
  setGithubToken,
  listGithubAnnouncements,
  addGithubAnnouncement,
  updateGithubAnnouncement,
  removeGithubAnnouncement,
  dispatchGithubTest,
} from './github-announcements.js';

const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? 'http://localhost:8787';
// Vide = pas de bot joignable (ex : GitHub Pages). L'onglet Sons bascule alors
// sur la liste publiée avec le site, en lecture seule.
const BOT_URL = import.meta.env.VITE_BOT_URL ?? (import.meta.env.DEV ? 'http://localhost:4242' : '');

function botUrl() {
  if (!BOT_URL) throw new Error('Aucun bot configuré (VITE_BOT_URL)');
  return BOT_URL;
}

export async function fetchPreview() {
  const res = await fetch(`${WORKER_URL}/api/preview`);
  if (!res.ok) {
    throw new Error(`Le worker a répondu ${res.status}`);
  }
  return res.json();
}

// editable : true si le bot répond (ajout de son possible depuis le dashboard),
// false si on lit sounds.json publié avec le site (ajout via GitHub).
export async function fetchSounds() {
  if (BOT_URL) {
    try {
      const res = await fetch(`${BOT_URL}/api/sounds`);
      if (res.ok) return { sounds: await res.json(), editable: true };
    } catch {
      // bot éteint : on retombe sur la liste publiée
    }
  }

  const res = await fetch(`${import.meta.env.BASE_URL}sounds.json`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`sounds.json a répondu ${res.status}`);
  }
  return { sounds: await res.json(), editable: false };
}

export async function uploadSound({ category, command, file }) {
  const form = new FormData();
  form.set('category', category);
  form.set('command', command);
  form.set('file', file);

  const res = await fetch(`${botUrl()}/api/sounds`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Le bot a répondu ${res.status}`);
  }
  return data;
}

// Trois façons de gérer les annonces, choisies au chargement de la liste :
// - "bot"      : le bot local répond, tout passe par son API ;
// - "github"   : pas de bot, mais un jeton GitHub est enregistré : le dashboard
//                modifie bot/announcements.json dans le repo (envoi par GitHub Actions) ;
// - "readonly" : ni l'un ni l'autre, on affiche la liste publiée avec le site.
let announcementsMode = 'readonly';

export async function fetchAnnouncements() {
  if (BOT_URL) {
    try {
      const res = await fetch(`${BOT_URL}/api/announcements`);
      if (res.ok) {
        announcementsMode = 'bot';
        return { list: await res.json(), mode: announcementsMode };
      }
    } catch {
      // bot éteint : on passe à GitHub
    }
  }

  if (getGithubToken()) {
    try {
      const list = await listGithubAnnouncements();
      announcementsMode = 'github';
      return { list, mode: announcementsMode };
    } catch (err) {
      if (err.status !== 401) throw err;
      setGithubToken(''); // jeton expiré ou révoqué : on réaffiche la connexion
    }
  }

  announcementsMode = 'readonly';
  const res = await fetch(`${import.meta.env.BASE_URL}announcements.json`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`announcements.json a répondu ${res.status}`);
  }
  return { list: await res.json(), mode: announcementsMode };
}

async function botJson(path, init) {
  const res = await fetch(`${botUrl()}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Le bot a répondu ${res.status}`);
  }
  return data;
}

export function addAnnouncement(text) {
  if (announcementsMode === 'github') return addGithubAnnouncement(text);
  return botJson('/api/announcements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export function updateAnnouncement(id, text) {
  if (announcementsMode === 'github') return updateGithubAnnouncement(id, text);
  return botJson(`/api/announcements/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export function deleteAnnouncement(id) {
  if (announcementsMode === 'github') return removeGithubAnnouncement(id);
  return botJson(`/api/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function fetchAnnounceSchedule() {
  return botJson('/api/announcements/schedule');
}

// Mode bot : { sent } = message envoyé. Mode GitHub : { dispatched: true },
// l'Action se lance et envoie le message une trentaine de secondes plus tard.
export async function testAnnouncement() {
  if (announcementsMode === 'github') {
    await dispatchGithubTest();
    return { dispatched: true };
  }
  return botJson('/api/announcements/test', { method: 'POST' });
}

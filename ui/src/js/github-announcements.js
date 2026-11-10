// Gestion des annonces sans bot : le dashboard lit et écrit directement
// bot/announcements.json dans le repo via l'API GitHub. Chaque modification
// est un commit, que GitHub Actions utilise dès l'envoi suivant.
//
// Il faut un jeton GitHub "fine-grained" limité à ce repo (Contents + Actions
// en écriture), collé une fois dans le dashboard. Il reste dans ce navigateur
// uniquement (localStorage), jamais dans le code ni sur le site.
const REPO = import.meta.env.VITE_GITHUB_REPO ?? 'upFrontEnd/stream-inflight-command';
const FILE_PATH = 'bot/announcements.json';
const BRANCH = 'main';
const TOKEN_KEY = 'stream-command-github-token';

export const TOKEN_CREATE_URL =
  'https://github.com/settings/personal-access-tokens/new?' +
  new URLSearchParams({
    name: 'Dashboard annonces',
    description: 'Modifier les annonces Twitch depuis le dashboard stream-inflight-command',
    target_name: REPO.split('/')[0],
    expires_in: '366', // maximum hors "jamais" : à recréer une fois par an
    contents: 'write',
    actions: 'write',
  });

export function getGithubToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setGithubToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // stockage indisponible (navigation privée...) : le jeton ne sera pas mémorisé
  }
}

const ERROR_BY_STATUS = {
  401: 'Jeton GitHub invalide ou expiré : reconnecte-toi avec un nouveau jeton.',
  403: 'Jeton GitHub sans les bonnes permissions (Contents et Actions en écriture sur ce repo).',
  404: 'Repo introuvable avec ce jeton : vérifie qu\'il donne accès à ce repo.',
  409: 'La liste a changé entre-temps : recharge la page et recommence.',
};

async function github(path, { token = getGithubToken(), ...init } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const error = new Error(ERROR_BY_STATUS[res.status] ?? `GitHub a répondu ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return res.status === 204 ? null : res.json();
}

// L'API renvoie le fichier en base64 ; atob/btoa ne gèrent pas l'UTF-8
// (emojis, accents) sans passer par des octets.
function decodeBase64Utf8(base64) {
  const binary = atob(base64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

function encodeBase64Utf8(text) {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// Vérifie le jeton avant de l'enregistrer.
export async function verifyGithubToken(token) {
  await github(`/repos/${REPO}`, { token });
}

async function readFile() {
  const data = await github(`/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`);
  const list = JSON.parse(decodeBase64Utf8(data.content));
  // Messages ajoutés à la main sans id : un id stable (sa position) pour
  // pouvoir les modifier, enregistré au prochain commit.
  list.forEach((entry, i) => {
    entry.id ??= `message-${i + 1}`;
  });
  return { list, sha: data.sha };
}

// Relit toujours la dernière version avant d'écrire : le sha garantit qu'on
// n'écrase pas une modification faite ailleurs entre-temps (sinon erreur 409).
async function updateFile(mutate, message) {
  const { list, sha } = await readFile();
  const result = mutate(list);
  await github(`/repos/${REPO}/contents/${FILE_PATH}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: encodeBase64Utf8(`${JSON.stringify(list, null, 2)}\n`),
      sha,
      branch: BRANCH,
    }),
  });
  return result;
}

export async function listGithubAnnouncements() {
  return (await readFile()).list;
}

export function addGithubAnnouncement(text) {
  return updateFile((list) => {
    const entry = { id: crypto.randomUUID(), text };
    list.push(entry);
    return entry;
  }, 'Annonces : ajout depuis le dashboard');
}

export function updateGithubAnnouncement(id, text) {
  return updateFile((list) => {
    const entry = list.find((a) => a.id === id);
    if (!entry) throw new Error('Message introuvable : recharge la page.');
    entry.text = text;
    return entry;
  }, 'Annonces : modification depuis le dashboard');
}

export function removeGithubAnnouncement(id) {
  return updateFile((list) => {
    const index = list.findIndex((a) => a.id === id);
    if (index !== -1) list.splice(index, 1);
    return { ok: index !== -1 };
  }, 'Annonces : suppression depuis le dashboard');
}

// Équivalent du bouton "Run workflow" : envoie le prochain message tout de suite.
export async function dispatchGithubTest() {
  await github(`/repos/${REPO}/actions/workflows/announce.yml/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: BRANCH, inputs: { test: true } }),
  });
}

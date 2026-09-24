import { readdir, mkdir } from 'node:fs/promises';
import { reloadCommands } from './commands-store.js';
import { listAnnouncements, addAnnouncement, updateAnnouncement, removeAnnouncement } from './announcements-store.js';
import { getNextAnnounceAt, getAnnounceIndex, getIsLive } from './announce-schedule.js';

const clients = new Set();

const OVERLAY_DIR = new URL('../overlay/', import.meta.url);
const SOUNDS_DIR = new URL('../sounds/', import.meta.url);

const CATEGORIES = ['all', 'sub', 'modo'];
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 Mo

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
};

const MAX_ANNOUNCEMENT_LENGTH = 450; // limite Twitch (500) moins de la marge

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

function sanitizeCommandName(raw) {
  const stripped = raw
    .trim()
    .toLowerCase()
    .replace(/^!+/, '')
    .replace(/[^\p{L}\p{N}_-]/gu, '');
  return stripped ? `!${stripped}` : null;
}

async function listSounds() {
  const result = {};
  for (const category of CATEGORIES) {
    try {
      const entries = await readdir(new URL(`${category}/`, SOUNDS_DIR));
      result[category] = entries.filter((entry) => AUDIO_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')).toLowerCase()));
    } catch {
      result[category] = [];
    }
  }
  return result;
}

async function handleUpload(req) {
  const form = await req.formData();
  const category = form.get('category');
  const commandRaw = form.get('command');
  const file = form.get('file');

  if (!CATEGORIES.includes(category)) {
    return jsonResponse({ error: `category doit être ${CATEGORIES.join('/')}` }, 400);
  }
  if (typeof commandRaw !== 'string' || !commandRaw.trim()) {
    return jsonResponse({ error: 'command manquant' }, 400);
  }
  if (!(file instanceof File)) {
    return jsonResponse({ error: 'file manquant' }, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonResponse({ error: `fichier trop volumineux (max ${MAX_UPLOAD_BYTES / 1024 / 1024} Mo)` }, 400);
  }

  const command = sanitizeCommandName(commandRaw);
  if (!command) {
    return jsonResponse({ error: 'nom de commande invalide' }, 400);
  }

  const dotIndex = file.name.lastIndexOf('.');
  const ext = dotIndex === -1 ? '' : file.name.slice(dotIndex).toLowerCase();
  if (!AUDIO_EXTENSIONS.has(ext)) {
    return jsonResponse({ error: `extension non supportée (${[...AUDIO_EXTENSIONS].join(', ')})` }, 400);
  }

  const categoryDir = new URL(`${category}/`, SOUNDS_DIR);
  await mkdir(categoryDir, { recursive: true });
  const destination = new URL(`${command}${ext}`, categoryDir);
  await Bun.write(destination, file);

  await reloadCommands();
  console.log(`[sounds] ${command} ajouté dans ${category}/ (${file.name})`);

  return jsonResponse({ ok: true, command, category, file: `${command}${ext}` });
}

function readAnnouncementText(body) {
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return { error: 'text manquant' };
  if (text.length > MAX_ANNOUNCEMENT_LENGTH) {
    return { error: `message trop long (max ${MAX_ANNOUNCEMENT_LENGTH} caractères)` };
  }
  return { text };
}

async function handleAddAnnouncement(req) {
  const body = await req.json().catch(() => null);
  const { text, error } = readAnnouncementText(body);
  if (error) return jsonResponse({ error }, 400);

  const entry = await addAnnouncement(text);
  console.log(`[announcements] ajouté : "${text}"`);
  return jsonResponse(entry);
}

async function handleUpdateAnnouncement(req, id) {
  const body = await req.json().catch(() => null);
  const { text, error } = readAnnouncementText(body);
  if (error) return jsonResponse({ error }, 400);

  const entry = await updateAnnouncement(id, text);
  if (!entry) return jsonResponse({ error: 'message introuvable' }, 404);

  console.log(`[announcements] modifié (${id}) : "${text}"`);
  return jsonResponse(entry);
}

export function startOverlayServer(port, { onTestAnnouncement } = {}) {
  return Bun.serve({
    port,
    async fetch(req, server) {
      const url = new URL(req.url);

      if (req.method === 'OPTIONS') {
        return new Response(null, { headers: CORS_HEADERS });
      }

      if (url.pathname === '/api/sounds' && req.method === 'GET') {
        return jsonResponse(await listSounds());
      }

      if (url.pathname === '/api/sounds' && req.method === 'POST') {
        try {
          return await handleUpload(req);
        } catch (err) {
          console.error('[sounds] échec upload :', err);
          return jsonResponse({ error: err instanceof Error ? err.message : 'Erreur inconnue' }, 500);
        }
      }

      if (url.pathname === '/api/announcements' && req.method === 'GET') {
        return jsonResponse(await listAnnouncements());
      }

      if (url.pathname === '/api/announcements' && req.method === 'POST') {
        try {
          return await handleAddAnnouncement(req);
        } catch (err) {
          console.error('[announcements] échec ajout :', err);
          return jsonResponse({ error: err instanceof Error ? err.message : 'Erreur inconnue' }, 500);
        }
      }

      if (url.pathname === '/api/announcements/schedule' && req.method === 'GET') {
        const list = await listAnnouncements();
        const nextAt = getNextAnnounceAt();
        const nextId = nextAt && list.length > 0 ? list[getAnnounceIndex() % list.length].id : null;
        return jsonResponse({ nextAt, nextId, live: getIsLive() });
      }

      if (url.pathname === '/api/announcements/test' && req.method === 'POST') {
        if (!onTestAnnouncement) return jsonResponse({ error: 'Test indisponible' }, 500);
        try {
          const entry = await onTestAnnouncement();
          return jsonResponse({ ok: true, sent: entry ?? null });
        } catch (err) {
          console.error('[announcements] échec test :', err);
          return jsonResponse({ error: err instanceof Error ? err.message : 'Erreur inconnue' }, 500);
        }
      }

      if (url.pathname.startsWith('/api/announcements/') && req.method === 'PUT') {
        const id = decodeURIComponent(url.pathname.slice('/api/announcements/'.length));
        try {
          return await handleUpdateAnnouncement(req, id);
        } catch (err) {
          console.error('[announcements] échec modification :', err);
          return jsonResponse({ error: err instanceof Error ? err.message : 'Erreur inconnue' }, 500);
        }
      }

      if (url.pathname.startsWith('/api/announcements/') && req.method === 'DELETE') {
        const id = decodeURIComponent(url.pathname.slice('/api/announcements/'.length));
        const removed = await removeAnnouncement(id);
        if (removed) console.log(`[announcements] supprimé : ${id}`);
        return jsonResponse({ ok: removed });
      }

      if (url.pathname === '/ws') {
        return server.upgrade(req) ? undefined : new Response('Upgrade failed', { status: 400 });
      }

      if (url.pathname.startsWith('/sounds/')) {
        const file = Bun.file(new URL('.' + url.pathname.slice('/sounds'.length), SOUNDS_DIR));
        if (await file.exists()) return new Response(file);
        console.warn(`[overlay] son introuvable : ${decodeURIComponent(url.pathname)}`);
        return new Response('Not found', { status: 404 });
      }

      const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const file = Bun.file(new URL(path, OVERLAY_DIR));
      if (await file.exists()) return new Response(file);

      return new Response('Not found', { status: 404 });
    },
    websocket: {
      open(ws) {
        clients.add(ws);
        console.log(`[overlay] client connecté (${clients.size} au total)`);
      },
      close(ws) {
        clients.delete(ws);
        console.log(`[overlay] client déconnecté (${clients.size} au total)`);
      },
      message() {},
    },
  });
}

export function broadcastPlay(soundFile) {
  console.log(`[overlay] diffusion de "${soundFile}" à ${clients.size} client(s)`);
  const payload = JSON.stringify({ type: 'play', sound: soundFile });
  for (const ws of clients) ws.send(payload);
}

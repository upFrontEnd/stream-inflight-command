import tmi from 'tmi.js';
import { reloadCommands, getCommands } from './commands-store.js';
import { hasPermission, getUserRole } from './permissions.js';
import { startOverlayServer, broadcastPlay } from './server.js';
import { isWorkerCommand, fetchWorkerReply } from './worker-commands.js';
import { listAnnouncements } from './announcements-store.js';
import { setNextAnnounceAt, consumeAnnounceIndex } from './announce-schedule.js';

const BOT_USERNAME = process.env.TWITCH_BOT_USERNAME;
const OAUTH_TOKEN = process.env.TWITCH_OAUTH_TOKEN;
const CHANNEL = process.env.TWITCH_CHANNEL;
const OVERLAY_PORT = Number(process.env.OVERLAY_PORT ?? 4242);
const ANNOUNCE_INTERVAL_MS = Number(process.env.ANNOUNCE_INTERVAL_MINUTES ?? 30) * 60_000;

if (!BOT_USERNAME || !OAUTH_TOKEN || !CHANNEL) {
  throw new Error(
    'TWITCH_BOT_USERNAME, TWITCH_OAUTH_TOKEN et TWITCH_CHANNEL sont requis (voir bot/.env.example)',
  );
}

const initialCommands = await reloadCommands();
console.log(`${Object.keys(initialCommands).length} commandes son chargées : ${Object.keys(initialCommands).join(', ')}`);

const client = new tmi.Client({
  identity: { username: BOT_USERNAME, password: OAUTH_TOKEN },
  channels: [CHANNEL],
});

// Cooldown global sur les sons : un seul son peut jouer toutes les
// SOUND_COOLDOWN_MS, peu importe qui le déclenche, pour éviter le chaos audio
// en cas de spam. Modérateurs et streamer y échappent (getUserRole ===
// 'moderator', qui couvre aussi le broadcaster — voir permissions.js).
const SOUND_COOLDOWN_MS = 10_000;
let lastSoundAt = 0;

client.on('message', (channel, userstate, message) => {
  // Pas de filtre "self" : le compte bot est ton propre compte Twitch, donc
  // tes propres messages doivent bien déclencher les commandes. Sans risque
  // de boucle : le bot n'envoie jamais de texte qui ressemble à une commande.
  const command = message.trim().toLowerCase();

  if (isWorkerCommand(command)) {
    fetchWorkerReply(command)
      .then((text) => client.say(channel, text))
      .catch((err) => console.error(`[worker] ${command} a échoué :`, err));
    return;
  }

  const sound = getCommands()[command];
  if (!sound) return;

  if (!hasPermission(userstate, sound.minRole)) {
    client.say(channel, `@${userstate['display-name']} tu n'as pas la permission d'utiliser ${command}`);
    return;
  }

  const isExempt = getUserRole(userstate) === 'moderator';
  const msSinceLastSound = Date.now() - lastSoundAt;
  if (!isExempt && msSinceLastSound < SOUND_COOLDOWN_MS) {
    return; // cooldown actif, on ignore silencieusement pour ne pas spammer le chat en retour
  }

  lastSoundAt = Date.now();
  broadcastPlay(sound.file);
});

// Messages qui tournent en boucle (Discord, follow, etc.), gérés depuis
// l'onglet Annonces du dashboard — aucun redémarrage requis pour les modifier,
// la liste est relue à chaque envoi. L'index de rotation vit dans
// announce-schedule.js pour que server.js puisse aussi savoir lequel est le
// prochain (compte à rebours affiché à côté du bon message dans le dashboard).
async function announceNext() {
  const list = await listAnnouncements();
  if (list.length === 0) return null;

  const index = consumeAnnounceIndex();
  const entry = list[index % list.length];
  client.say(CHANNEL, entry.text);
  console.log(`[announcements] envoyé : "${entry.text}"`);
  return entry;
}

function scheduleNextAnnounce() {
  setNextAnnounceAt(Date.now() + ANNOUNCE_INTERVAL_MS);
}

scheduleNextAnnounce();
setInterval(() => {
  announceNext().catch((err) => console.error('[announcements] échec envoi :', err));
  scheduleNextAnnounce();
}, ANNOUNCE_INTERVAL_MS);

await client.connect();
startOverlayServer(OVERLAY_PORT, {
  // Bouton "Tester maintenant" du dashboard : envoie le prochain message de
  // la rotation tout de suite, sans toucher au minutage des envois planifiés.
  onTestAnnouncement: () => announceNext(),
});
console.log(`Overlay sons dispo sur http://localhost:${OVERLAY_PORT} (à ajouter comme Browser Source dans OBS)`);
console.log(`API de gestion des sons dispo sur http://localhost:${OVERLAY_PORT}/api/sounds`);
console.log(`Annonces toutes les ${ANNOUNCE_INTERVAL_MS / 60_000} min, gérées sur http://localhost:${OVERLAY_PORT}/api/announcements`);

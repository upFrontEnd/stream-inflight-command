import tmi from 'tmi.js';
import { reloadCommands, getCommands } from './commands-store.js';
import { hasPermission } from './permissions.js';
import { startOverlayServer, broadcastPlay } from './server.js';
import { isWorkerCommand, fetchWorkerReply } from './worker-commands.js';

const BOT_USERNAME = process.env.TWITCH_BOT_USERNAME;
const OAUTH_TOKEN = process.env.TWITCH_OAUTH_TOKEN;
const CHANNEL = process.env.TWITCH_CHANNEL;
const OVERLAY_PORT = Number(process.env.OVERLAY_PORT ?? 4242);

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

// IRC/Twitch ne supporte pas les sauts de ligne dans un seul message : chaque
// ligne devient de toute façon un message séparé, avec un petit délai entre
// chaque envoi pour garder l'ordre et éviter le rate-limit Twitch. Deux
// niveaux de coupure dans le texte source : "\n\n" = paragraphe (une ligne
// vide s'affiche entre les deux), simple "\n" = juste deux messages collés
// sans ligne vide. Twitch refuse les messages vraiment vides, donc la "ligne
// vide" est en réalité un caractère invisible (Hangul Filler, U+3164).
const BLANK_LINE = 'ㅤ';
const DELAY_MS = 1200;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sayLines(channel, text) {
  const paragraphs = text
    .split('\n\n')
    .map((p) => p.split('\n').filter((line) => line.trim()))
    .filter((p) => p.length > 0);

  for (const [pIndex, lines] of paragraphs.entries()) {
    if (pIndex > 0) {
      await wait(DELAY_MS);
      client.say(channel, BLANK_LINE);
      await wait(DELAY_MS);
    }
    for (const [lIndex, line] of lines.entries()) {
      if (lIndex > 0) await wait(DELAY_MS);
      client.say(channel, line);
    }
  }
}

client.on('message', (channel, userstate, message) => {
  // Pas de filtre "self" : le compte bot est ton propre compte Twitch, donc
  // tes propres messages doivent bien déclencher les commandes. Sans risque
  // de boucle : le bot n'envoie jamais de texte qui ressemble à une commande.
  const command = message.trim().toLowerCase();

  if (isWorkerCommand(command)) {
    fetchWorkerReply(command)
      .then((text) => sayLines(channel, text))
      .catch((err) => console.error(`[worker] ${command} a échoué :`, err));
    return;
  }

  const sound = getCommands()[command];
  if (!sound) return;

  if (!hasPermission(userstate, sound.minRole)) {
    client.say(channel, `@${userstate['display-name']} tu n'as pas la permission d'utiliser ${command}`);
    return;
  }

  broadcastPlay(sound.file);
});

await client.connect();
startOverlayServer(OVERLAY_PORT);
console.log(`Overlay sons dispo sur http://localhost:${OVERLAY_PORT} (à ajouter comme Browser Source dans OBS)`);
console.log(`API de gestion des sons dispo sur http://localhost:${OVERLAY_PORT}/api/sounds`);

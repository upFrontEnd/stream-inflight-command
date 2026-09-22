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

// IRC/Twitch ne supporte pas les sauts de ligne dans un seul message : un
// texte multi-paragraphes (séparé par \n) est envoyé comme plusieurs messages
// de chat consécutifs, avec un petit délai pour garder l'ordre et éviter le
// rate-limit Twitch.
async function sayLines(channel, text) {
  const lines = text.split('\n').filter((line) => line.trim());
  for (const [i, line] of lines.entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1200));
    client.say(channel, line);
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

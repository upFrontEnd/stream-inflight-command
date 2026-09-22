import tmi from 'tmi.js';
import { soundCommands } from './commands.js';
import { hasPermission } from './permissions.js';
import { startOverlayServer, broadcastPlay } from './server.js';

const BOT_USERNAME = process.env.TWITCH_BOT_USERNAME;
const OAUTH_TOKEN = process.env.TWITCH_OAUTH_TOKEN;
const CHANNEL = process.env.TWITCH_CHANNEL;
const OVERLAY_PORT = Number(process.env.OVERLAY_PORT ?? 4242);

if (!BOT_USERNAME || !OAUTH_TOKEN || !CHANNEL) {
  throw new Error(
    'TWITCH_BOT_USERNAME, TWITCH_OAUTH_TOKEN et TWITCH_CHANNEL sont requis (voir bot/.env.example)',
  );
}

const client = new tmi.Client({
  identity: { username: BOT_USERNAME, password: OAUTH_TOKEN },
  channels: [CHANNEL],
});

client.on('message', (channel, userstate, message, self) => {
  if (self) return;

  const command = message.trim().toLowerCase();
  const sound = soundCommands[command];
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

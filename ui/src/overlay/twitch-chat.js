// Lecture du chat Twitch en anonyme, directement depuis le navigateur : le
// serveur IRC de Twitch accepte les connexions "justinfan" sans token, en
// lecture seule. Aucun bot, aucun secret, rien à héberger.
const IRC_URL = 'wss://irc-ws.chat.twitch.tv:443';
const RECONNECT_DELAY_MS = 3000;

function parseTags(raw) {
  const tags = {};
  for (const pair of raw.split(';')) {
    const i = pair.indexOf('=');
    tags[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return tags;
}

function parseBadges(raw) {
  const badges = {};
  if (!raw) return badges;
  for (const badge of raw.split(',')) {
    const [name, version] = badge.split('/');
    badges[name] = version;
  }
  return badges;
}

// Une ligne IRC : "@tags :prefix COMMANDE params :texte"
function parseLine(line) {
  let rest = line;
  let tags = {};

  if (rest.startsWith('@')) {
    const space = rest.indexOf(' ');
    tags = parseTags(rest.slice(1, space));
    rest = rest.slice(space + 1);
  }
  if (rest.startsWith(':')) {
    rest = rest.slice(rest.indexOf(' ') + 1);
  }

  const trailingIndex = rest.indexOf(' :');
  const head = trailingIndex === -1 ? rest : rest.slice(0, trailingIndex);
  const text = trailingIndex === -1 ? '' : rest.slice(trailingIndex + 2);
  const [command] = head.split(' ');

  return { tags, command, text };
}

// Même logique que bot/src/permissions.js : le streamer compte comme modo.
export function getUserRole(tags) {
  const badges = parseBadges(tags.badges);
  if (badges.broadcaster || tags.mod === '1') return 'moderator';
  if (tags.subscriber === '1' || badges.subscriber || badges.founder) return 'subscriber';
  return 'viewer';
}

export function connectToChat(channel, { onMessage, onStatus }) {
  function connect() {
    const ws = new WebSocket(IRC_URL);

    ws.addEventListener('open', () => {
      ws.send('CAP REQ :twitch.tv/tags');
      ws.send('PASS SCHMOOPIIE');
      ws.send(`NICK justinfan${Math.floor(10000 + Math.random() * 80000)}`);
      ws.send(`JOIN #${channel}`);
    });

    ws.addEventListener('message', (event) => {
      for (const line of event.data.split('\r\n')) {
        if (!line) continue;
        const { tags, command, text } = parseLine(line);

        if (command === 'PING') {
          ws.send(`PONG :${text || 'tmi.twitch.tv'}`);
        } else if (command === 'JOIN') {
          onStatus?.('connected');
        } else if (command === 'RECONNECT') {
          ws.close();
        } else if (command === 'PRIVMSG') {
          onMessage({ text, tags, displayName: tags['display-name'] ?? '' });
        }
      }
    });

    ws.addEventListener('close', () => {
      onStatus?.('disconnected');
      setTimeout(connect, RECONNECT_DELAY_MS);
    });
  }

  connect();
}

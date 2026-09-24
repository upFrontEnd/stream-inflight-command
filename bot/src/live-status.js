// Le chat Twitch (tmi.js/IRC) ne notifie pas quand la chaîne passe en
// direct : on sonde périodiquement l'API Helix "Get Streams" (lecture
// publique, aucun scope particulier requis au-delà d'un token valide) pour
// le savoir.
const HELIX_STREAMS_URL = 'https://api.twitch.tv/helix/streams';

export async function isChannelLive({ clientId, accessToken, channelLogin }) {
  const url = `${HELIX_STREAMS_URL}?user_login=${encodeURIComponent(channelLogin)}`;
  const res = await fetch(url, {
    headers: {
      'Client-Id': clientId,
      Authorization: `Bearer ${accessToken.replace(/^oauth:/, '')}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Helix /streams a répondu ${res.status}`);
  }
  const { data } = await res.json();
  return data.length > 0;
}

// Sonde toutes les `intervalMs` et n'appelle onLive()/onOffline() qu'au
// changement d'état (pas à chaque sondage), y compris dès le premier appel
// si le bot démarre alors que le stream est déjà en direct.
export function watchLiveStatus({ clientId, getAccessToken, channelLogin, intervalMs = 60_000, onLive, onOffline }) {
  let wasLive = null; // null = état pas encore connu, pour forcer le premier appel

  async function check() {
    let live;
    try {
      live = await isChannelLive({ clientId, accessToken: getAccessToken(), channelLogin });
    } catch (err) {
      console.error('[live] vérification du statut live échouée :', err.message);
      return;
    }

    if (live === wasLive) return;
    wasLive = live;
    if (live) onLive();
    else onOffline();
  }

  check();
  return setInterval(check, intervalMs);
}

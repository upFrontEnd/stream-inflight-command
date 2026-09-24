// Implémente le Device Code Grant Flow officiel de Twitch pour obtenir un
// token OAuth sans dépendre d'un générateur tiers (twitchapps.com/tmi est
// discontinué). Doc : https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#device-code-grant-flow
//
// L'access token obtenu n'est valable que 4h ; bot/src/twitch-auth.js s'en
// sert avec le refresh token pour se renouveler tout seul ensuite, ce script
// ne sert donc qu'une fois (sauf si le refresh token expire après 30 jours
// d'inactivité du bot).
import { persistTokens } from './twitch-auth.js';

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const SCOPES = 'chat:read chat:edit';

if (!CLIENT_ID) {
  throw new Error('TWITCH_CLIENT_ID manquant dans bot/.env (voir bot/.env.example)');
}

async function requestDeviceCode() {
  const res = await fetch('https://id.twitch.tv/oauth2/device', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scopes: SCOPES }),
  });
  if (!res.ok) {
    throw new Error(`Demande de device code refusée : ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function pollForToken(deviceCode, initialInterval) {
  let interval = initialInterval;
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));

    const res = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        scopes: SCOPES,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const data = await res.json();

    if (res.ok) return data;
    if (data.message === 'authorization_pending') continue;
    if (data.message === 'slow_down') {
      interval += 5;
      continue;
    }
    throw new Error(`Autorisation refusée : ${data.message ?? res.status}`);
  }
}

const { device_code, user_code, verification_uri, interval } = await requestDeviceCode();

console.log('\nOuvre cette page et connecte-toi avec le compte qui doit parler dans le chat :');
console.log(`  ${verification_uri}`);
console.log(`Code à saisir si demandé : ${user_code}\n`);
console.log('En attente de validation...');

const token = await pollForToken(device_code, interval ?? 5);

await persistTokens({ accessToken: token.access_token, refreshToken: token.refresh_token });

console.log('\n✅ Token obtenu et enregistré dans bot/.env (TWITCH_OAUTH_TOKEN + TWITCH_REFRESH_TOKEN).');
console.log('Le bot se rafraîchira automatiquement ensuite, plus besoin de relancer cette commande.\n');

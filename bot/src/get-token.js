// Autorisation manuelle en local (Device Code Flow officiel de Twitch). Sur
// Railway, inutile : le bot lance lui-même ce flux et affiche le lien sur /auth
// quand il n'a plus de token valide.
import { authorizeDevice } from './twitch-auth.js';

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;

if (!CLIENT_ID) {
  throw new Error('TWITCH_CLIENT_ID manquant dans bot/.env (voir bot/.env.example)');
}

await authorizeDevice({
  clientId: CLIENT_ID,
  onCode: ({ verificationUri, userCode }) => {
    console.log('\nOuvre cette page et connecte-toi avec le compte qui doit parler dans le chat :');
    console.log(`  ${verificationUri}`);
    console.log(`Code à saisir si demandé : ${userCode}\n`);
    console.log('En attente de validation...');
  },
});

console.log('\n✅ Token obtenu et enregistré.\n');

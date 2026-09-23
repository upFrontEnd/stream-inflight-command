#!/usr/bin/env bun
// Relance automatiquement le bot s'il plante (token Twitch expiré, coupure
// réseau, etc.) au lieu de rester éteint en silence jusqu'à ce qu'on le
// remarque en plein live. Délai croissant entre les tentatives (5s -> 60s
// max) pour ne pas marteler l'API Twitch si le problème persiste (ex: token
// toujours invalide, il faudra quand même relancer `bun run bot:token`).
// Remplace l'ancien bot-watchdog.sh : pur JS, tourne pareil sur Mac/Windows/Linux.
import { spawnSync } from 'node:child_process';

const MIN_DELAY_MS = 5_000;
const MAX_DELAY_MS = 60_000;
let delay = MIN_DELAY_MS;

for (;;) {
  console.log('[watchdog] démarrage du bot...');
  const result = spawnSync('bun', ['--env-file=bot/.env', 'bot/src/index.js'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const code = result.status ?? 1;

  if (code === 0) {
    console.log('[watchdog] bot arrêté proprement (code 0), pas de redémarrage.');
    break;
  }

  console.log(`[watchdog] bot arrêté (code ${code}). Nouvelle tentative dans ${delay / 1000}s...`);
  await new Promise((resolve) => setTimeout(resolve, delay));
  delay = Math.min(delay * 2, MAX_DELAY_MS);
}

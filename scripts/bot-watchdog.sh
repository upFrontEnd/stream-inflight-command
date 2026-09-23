#!/usr/bin/env bash
# Relance automatiquement le bot s'il plante (token Twitch expiré, coupure
# réseau, etc.) au lieu de rester éteint en silence jusqu'à ce qu'on le
# remarque en plein live. Délai croissant entre les tentatives (5s -> 60s max)
# pour ne pas marteler l'API Twitch si le problème persiste (ex: token
# toujours invalide, il faudra quand même relancer `bun run bot:token`).
set -uo pipefail

cd "$(dirname "$0")/.."

MIN_DELAY=5
MAX_DELAY=60
delay=$MIN_DELAY

while true; do
  echo "[watchdog] démarrage du bot..."
  bun --env-file=bot/.env bot/src/index.js
  code=$?

  if [ "$code" -eq 0 ]; then
    echo "[watchdog] bot arrêté proprement (code 0), pas de redémarrage."
    break
  fi

  echo "[watchdog] bot arrêté (code $code). Nouvelle tentative dans ${delay}s..."
  sleep "$delay"
  delay=$(( delay * 2 ))
  if [ "$delay" -gt "$MAX_DELAY" ]; then
    delay=$MAX_DELAY
  fi
done

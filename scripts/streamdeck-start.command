#!/bin/bash
# Fait pour être lancé par un bouton Stream Deck (action "Système > Ouvrir"
# pointée sur ce fichier) : ouvre un Terminal et démarre Worker + UI + bot
# ensemble. Laisse la fenêtre ouverte pour voir les logs / faire Ctrl+C.
cd "$(dirname "$0")/.."
bun run dev

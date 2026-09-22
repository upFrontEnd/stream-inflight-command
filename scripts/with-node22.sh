#!/usr/bin/env bash
# Bascule automatiquement sur Node 22+ (via nvm) avant d'exécuter la commande
# passée en argument. Évite d'avoir à taper `nvm use` à la main dans chaque
# terminal — wrangler plante silencieusement sous Node < 22 ou sous Bun.
set -euo pipefail

NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  source "$NVM_DIR/nvm.sh"
  nvm use --silent >/dev/null
fi

exec "$@"

// Une commande par entrée. minRole : "viewer" | "subscriber" | "moderator".
// Les fichiers audio vont dans bot/sounds/ (non commités, voir bot/sounds/README.md).
export const soundCommands = {
  '!boom': { file: 'boom.mp3', minRole: 'viewer' },
  '!airhorn': { file: 'airhorn.mp3', minRole: 'subscriber' },
  '!alert': { file: 'alert.mp3', minRole: 'moderator' },
};

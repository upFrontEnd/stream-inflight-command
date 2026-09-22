import { readdir } from 'node:fs/promises';

// Le nom du fichier devient la commande, le dossier détermine qui peut
// l'utiliser. Dépose un .mp3/.wav/.ogg dans un des trois dossiers, pas besoin
// de toucher au code.
const ROLE_BY_FOLDER = { all: 'viewer', sub: 'subscriber', modo: 'moderator' };
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg']);
const SOUNDS_DIR = new URL('../sounds/', import.meta.url);

export async function loadSoundCommands() {
  const commands = {};

  for (const [folder, minRole] of Object.entries(ROLE_BY_FOLDER)) {
    let entries;
    try {
      entries = await readdir(new URL(`${folder}/`, SOUNDS_DIR));
    } catch {
      continue; // dossier absent, on l'ignore
    }

    for (const entry of entries) {
      const dotIndex = entry.lastIndexOf('.');
      if (dotIndex === -1) continue;
      if (!AUDIO_EXTENSIONS.has(entry.slice(dotIndex).toLowerCase())) continue;

      const name = entry.slice(0, dotIndex).toLowerCase();
      const command = name.startsWith('!') ? name : `!${name}`;

      if (commands[command]) {
        console.warn(`⚠️  ${command} existe dans plusieurs dossiers, "${folder}/${entry}" écrase le précédent`);
      }
      commands[command] = { file: `${folder}/${entry}`, minRole };
    }
  }

  return commands;
}

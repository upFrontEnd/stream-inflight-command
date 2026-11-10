import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Publie bot/sounds/ avec le dashboard pour que l'overlay GitHub Pages puisse
// jouer les sons sans aucun serveur : chaque fichier est servi sous
// sounds/<catégorie>/<fichier>, et sounds.json liste le tout (même format que
// GET /api/sounds du bot). En dev, les mêmes URLs sont servies par Vite.
const SOUNDS_DIR = fileURLToPath(new URL('../bot/sounds/', import.meta.url));
const CATEGORIES = ['all', 'sub', 'modo'];
const MIME_BY_EXTENSION = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg' };

function extensionOf(name) {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

async function scanSounds() {
  const manifest = {};
  for (const category of CATEGORIES) {
    try {
      const entries = await readdir(join(SOUNDS_DIR, category));
      manifest[category] = entries.filter((entry) => MIME_BY_EXTENSION[extensionOf(entry)]).sort();
    } catch {
      manifest[category] = [];
    }
  }
  return manifest;
}

export function soundsPlugin() {
  return {
    name: 'stream-sounds',

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

        if (pathname === '/sounds.json') {
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(await scanSounds()));
          return;
        }

        const match = pathname.match(/^\/sounds\/([^/]+)\/([^/]+)$/);
        if (match) {
          const [, category, file] = match;
          const manifest = await scanSounds();
          // Seuls les fichiers listés sont servis : pas de sortie du dossier possible.
          if (manifest[category]?.includes(file)) {
            res.setHeader('content-type', MIME_BY_EXTENSION[extensionOf(file)]);
            res.end(await readFile(join(SOUNDS_DIR, category, file)));
            return;
          }
        }

        next();
      });
    },

    async generateBundle() {
      const manifest = await scanSounds();
      this.emitFile({ type: 'asset', fileName: 'sounds.json', source: JSON.stringify(manifest) });
      for (const category of CATEGORIES) {
        for (const file of manifest[category]) {
          this.emitFile({
            type: 'asset',
            fileName: `sounds/${category}/${file}`,
            source: await readFile(join(SOUNDS_DIR, category, file)),
          });
        }
      }
    },
  };
}

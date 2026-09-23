#!/usr/bin/env bun
// Lance la commande passée en argument sous Node 22+ (requis par wrangler).
// Remplace l'ancien with-node22.sh : pur JS, tourne pareil sur Mac/Windows/Linux.
//
// - Si le `node` sur le PATH est déjà en 22+, on exécute la commande directement.
// - Sinon, sur macOS/Linux avec nvm installé, on rebascule via nvm (comme le
//   faisait with-node22.sh) et on relance.
// - Sinon (Windows sans Node 22+, ou pas de nvm), on explique quoi installer
//   plutôt que de planter en silence.
import { spawnSync } from 'node:child_process';

const REQUIRED_MAJOR = 22;
const isWindows = process.platform === 'win32';
const [, , command, ...commandArgs] = process.argv;

if (!command) {
  console.error('Usage: bun scripts/run-with-node22.mjs <commande> [args...]');
  process.exit(1);
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: isWindows });
  process.exit(result.status ?? 1);
}

function systemNodeMajor() {
  try {
    const result = spawnSync('node', ['--version'], { encoding: 'utf8', shell: isWindows });
    const version = result.stdout?.trim().replace(/^v/, '') ?? '0';
    return Number(version.split('.')[0]);
  } catch {
    return 0;
  }
}

if (systemNodeMajor() >= REQUIRED_MAJOR) {
  run(command, commandArgs);
}

if (isWindows) {
  console.error(
    `Node ${REQUIRED_MAJOR}+ requis pour cette commande (${command}). ` +
      'Installe une version récente depuis https://nodejs.org puis relance.',
  );
  process.exit(1);
}

// macOS/Linux : tente de rebasculer via nvm, comme l'ancien script bash.
const nvmDir = process.env.NVM_DIR ?? `${process.env.HOME}/.nvm`;
const script = `NVM_DIR="${nvmDir}"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; nvm use --silent >/dev/null 2>&1; exec "$@"`;
run('bash', ['-c', script, 'bash', command, ...commandArgs]);

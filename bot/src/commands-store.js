import { loadSoundCommands } from './load-commands.js';

let commands = {};

export async function reloadCommands() {
  commands = await loadSoundCommands();
  return commands;
}

export function getCommands() {
  return commands;
}

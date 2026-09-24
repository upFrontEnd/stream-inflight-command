import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SOUNDS_DIR = new URL('../sounds/', import.meta.url);

// Joue le son directement sur la machine qui fait tourner le bot (celle du
// live, sous Windows) plutôt que de compter sur l'overlay OBS pour le faire :
// plus besoin d'ajouter/ouvrir une Browser Source pour que le son sorte, OBS
// le capte comme n'importe quel autre programme via sa source "Audio de
// bureau". broadcastPlay() (server.js) reste appelé en parallèle, pour un
// futur overlay visuel éventuel, mais n'est plus requis pour l'audio.
export function playSoundFile(relativePath) {
  const path = fileURLToPath(new URL(relativePath, SOUNDS_DIR));
  const child = spawnPlayer(path);
  if (!child) return;

  child.on('error', (err) => console.error(`[son] lecture impossible (${relativePath}) :`, err.message));
  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString().trim();
    if (text) console.error(`[son] ${relativePath} :`, text);
  });
}

function spawnPlayer(path) {
  if (process.platform === 'darwin') {
    return spawn('afplay', [path], { stdio: ['ignore', 'ignore', 'pipe'] });
  }

  if (process.platform === 'win32') {
    // Pas de dépendance externe (ffmpeg/mplayer...) : WPF MediaPlayer
    // (assembly PresentationCore) s'appuie sur Media Foundation, qui décode
    // mp3/wav nativement sur Windows 10/11. Le script attend la durée réelle
    // du fichier avant de rendre la main, sinon PowerShell tue le lecteur
    // dès la fin du script.
    const escapedPath = path.replace(/'/g, "''");
    const script = [
      'Add-Type -AssemblyName PresentationCore',
      '$player = New-Object System.Windows.Media.MediaPlayer',
      `$player.Open([Uri]::new('${escapedPath}'))`,
      '$player.Play()',
      '$timeout = 0',
      'while (-not $player.NaturalDuration.HasTimeSpan -and $timeout -lt 50) { Start-Sleep -Milliseconds 100; $timeout++ }',
      'if ($player.NaturalDuration.HasTimeSpan) { Start-Sleep -Seconds $player.NaturalDuration.TimeSpan.TotalSeconds } else { Start-Sleep -Seconds 5 }',
      '$player.Close()',
    ].join('; ');

    return spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
  }

  console.warn(`[son] plateforme "${process.platform}" non supportée pour la lecture native, son ignoré : ${path}`);
  return null;
}

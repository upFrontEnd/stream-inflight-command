// OBS injecte "OBS/x.x.x" dans le user agent de ses Browser Sources et n'y
// applique pas la restriction autoplay, dans ce cas le bouton ne doit
// jamais apparaître (il polluerait visuellement le stream).
const isObsBrowserSource = /\bOBS\//.test(navigator.userAgent);
const unlockEl = document.querySelector('#unlock');

if (isObsBrowserSource) {
  unlockEl?.remove();
} else if (unlockEl) {
  unlockEl.addEventListener('click', () => unlockEl.remove(), { once: true });
}

function connect() {
  const ws = new WebSocket(`ws://${location.host}/ws`);

  ws.addEventListener('open', () => console.log('[overlay] connecté au bot'));

  ws.addEventListener('message', (event) => {
    console.log('[overlay] message reçu :', event.data);
    const data = JSON.parse(event.data);
    if (data.type === 'play') {
      const url = `/sounds/${data.sound}`;
      const audio = new Audio(url);
      audio
        .play()
        .then(() => console.log('[overlay] lecture lancée :', url))
        .catch((err) => console.error('[overlay] lecture impossible :', url, err));
    }
  });

  ws.addEventListener('close', () => {
    console.log('[overlay] déconnecté, nouvelle tentative dans 3s');
    setTimeout(connect, 3000);
  });
}

connect();

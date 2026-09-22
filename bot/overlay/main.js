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

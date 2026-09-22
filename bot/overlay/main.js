function connect() {
  const ws = new WebSocket(`ws://${location.host}/ws`);

  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'play') {
      const audio = new Audio(`/sounds/${data.sound}`);
      audio.play().catch((err) => console.error('Lecture impossible :', err));
    }
  });

  ws.addEventListener('close', () => {
    setTimeout(connect, 3000);
  });
}

connect();

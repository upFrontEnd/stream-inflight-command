const clients = new Set();

const OVERLAY_DIR = new URL('./overlay/', import.meta.url);
const SOUNDS_DIR = new URL('./sounds/', import.meta.url);

export function startOverlayServer(port) {
  return Bun.serve({
    port,
    async fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === '/ws') {
        return server.upgrade(req) ? undefined : new Response('Upgrade failed', { status: 400 });
      }

      if (url.pathname.startsWith('/sounds/')) {
        const file = Bun.file(new URL('.' + url.pathname.slice('/sounds'.length), SOUNDS_DIR));
        if (await file.exists()) return new Response(file);
        return new Response('Not found', { status: 404 });
      }

      const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const file = Bun.file(new URL(path, OVERLAY_DIR));
      if (await file.exists()) return new Response(file);

      return new Response('Not found', { status: 404 });
    },
    websocket: {
      open(ws) {
        clients.add(ws);
      },
      close(ws) {
        clients.delete(ws);
      },
      message() {},
    },
  });
}

export function broadcastPlay(soundFile) {
  const payload = JSON.stringify({ type: 'play', sound: soundFile });
  for (const ws of clients) ws.send(payload);
}

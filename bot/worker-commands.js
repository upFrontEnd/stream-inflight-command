const WORKER_URL = process.env.WORKER_URL ?? 'http://localhost:8787';

const ROUTES = {
  '!vol': '/vol',
  '!appareil': '/appareil',
  '!plandevol': '/plandevol',
  '!meteo': '/meteo',
};

export function isWorkerCommand(command) {
  return command in ROUTES;
}

export async function fetchWorkerReply(command) {
  const res = await fetch(`${WORKER_URL}${ROUTES[command]}`);
  return res.text();
}

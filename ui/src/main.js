import './style.scss';
import { fetchPreview } from './api.js';

const COMMANDS = [
  { key: 'vol', label: '!vol' },
  { key: 'appareil', label: '!appareil' },
  { key: 'plandevol', label: '!plandevol' },
  { key: 'meteo', label: '!meteo' },
];

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="app">
    <header class="app__header">
      <h1>Stream Inflight Command</h1>
      <p class="app__subtitle">Prévisualise les commandes avant le live</p>
      <button id="refresh" class="button" type="button">Rafraîchir</button>
      <span id="status" class="status"></span>
    </header>
    <section id="cards" class="cards"></section>
    <details class="raw-panel">
      <summary>Données brutes SimBrief</summary>
      <pre id="raw-json"></pre>
    </details>
  </main>
`;

const cardsEl = document.querySelector('#cards');
const statusEl = document.querySelector('#status');
const refreshBtn = document.querySelector('#refresh');
const rawJsonEl = document.querySelector('#raw-json');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderCards(data) {
  cardsEl.innerHTML = COMMANDS.map(({ key, label }) => {
    const entry = data[key];
    const stateClass = entry.ok ? 'card--ok' : 'card--error';
    return `
      <article class="card ${stateClass}">
        <div class="card__header">
          <span class="card__command">${label}</span>
          <span class="card__badge">${entry.ok ? 'OK' : 'Erreur'}</span>
        </div>
        <p class="card__text">${escapeHtml(entry.text)}</p>
      </article>
    `;
  }).join('');

  rawJsonEl.textContent = JSON.stringify(data.raw, null, 2);
}

async function load() {
  statusEl.textContent = 'Chargement…';
  statusEl.className = 'status';
  refreshBtn.disabled = true;
  try {
    const data = await fetchPreview();
    renderCards(data);
    statusEl.textContent = `Mis à jour à ${new Date().toLocaleTimeString('fr-FR')}`;
  } catch (err) {
    statusEl.textContent = err instanceof Error ? err.message : 'Erreur inconnue';
    statusEl.className = 'status status--error';
  } finally {
    refreshBtn.disabled = false;
  }
}

refreshBtn.addEventListener('click', load);
load();

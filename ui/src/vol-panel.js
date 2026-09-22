import { fetchPreview } from './api.js';

const COMMANDS = [
  { key: 'appareil', label: '!appareil' },
  { key: 'plandevol', label: '!plandevol' },
  { key: 'meteo', label: '!meteo' },
];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function mountVolPanel(root) {
  root.innerHTML = `
    <div class="panel__toolbar">
      <button id="vol-refresh" class="button" type="button">Rafraîchir</button>
      <span id="vol-status" class="status"></span>
    </div>
    <section id="vol-cards" class="cards"></section>
    <details class="raw-panel">
      <summary>Données brutes SimBrief</summary>
      <pre id="vol-raw"></pre>
    </details>
  `;

  const cardsEl = root.querySelector('#vol-cards');
  const statusEl = root.querySelector('#vol-status');
  const refreshBtn = root.querySelector('#vol-refresh');
  const rawEl = root.querySelector('#vol-raw');

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

    rawEl.textContent = JSON.stringify(data.raw, null, 2);
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
}

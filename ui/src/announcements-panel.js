import { fetchAnnouncements, addAnnouncement, deleteAnnouncement } from './api.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function mountAnnouncementsPanel(root) {
  root.innerHTML = `
    <form id="announce-form" class="upload-card">
      <h2 class="upload-card__title">Ajouter un message</h2>

      <label class="field">
        <span class="field__label">Texte</span>
        <textarea id="announce-input" rows="2" placeholder="Rejoins le Discord : ..." required></textarea>
      </label>

      <button type="submit" class="button button--primary">Ajouter</button>
      <p id="announce-status" class="status"></p>
    </form>

    <ul class="announce-list" id="announce-list"></ul>
  `;

  const form = root.querySelector('#announce-form');
  const input = root.querySelector('#announce-input');
  const statusEl = root.querySelector('#announce-status');
  const listEl = root.querySelector('#announce-list');

  function renderList(items) {
    listEl.innerHTML = items.length
      ? items
          .map(
            (a) => `
            <li class="announce-item">
              <span class="announce-item__text">${escapeHtml(a.text)}</span>
              <button type="button" class="announce-item__remove" data-id="${a.id}" title="Supprimer" aria-label="Supprimer">✕</button>
            </li>
          `,
          )
          .join('')
      : '<li class="status">Aucun message pour l\'instant.</li>';
  }

  async function loadList() {
    try {
      renderList(await fetchAnnouncements());
    } catch (err) {
      listEl.innerHTML = `<li class="status status--error">${err instanceof Error ? err.message : 'Erreur inconnue'}</li>`;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    statusEl.textContent = 'Ajout en cours…';
    statusEl.className = 'status';

    try {
      await addAnnouncement(text);
      form.reset();
      statusEl.textContent = 'Message ajouté.';
      await loadList();
    } catch (err) {
      statusEl.textContent = err instanceof Error ? err.message : 'Erreur inconnue';
      statusEl.className = 'status status--error';
    }
  });

  listEl.addEventListener('click', async (event) => {
    const btn = event.target.closest('.announce-item__remove');
    if (!btn) return;

    try {
      await deleteAnnouncement(btn.dataset.id);
      await loadList();
    } catch (err) {
      statusEl.textContent = err instanceof Error ? err.message : 'Erreur inconnue';
      statusEl.className = 'status status--error';
    }
  });

  loadList();
}

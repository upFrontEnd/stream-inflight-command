import { fetchAnnouncements, addAnnouncement, deleteAnnouncement, fetchAnnounceSchedule, testAnnouncement } from './api.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function mountAnnouncementsPanel(root) {
  root.innerHTML = `
    <div class="panel__toolbar">
      <button type="button" id="test-announce" class="button">Tester maintenant</button>
    </div>

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

  const testBtn = root.querySelector('#test-announce');
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
    tickCountdown(); // ré-accroche le badge sur le bon <li>, la liste vient d'être reconstruite
  }

  // Compte à rebours affiché à côté du message qui sera envoyé ensuite (pas
  // en général en haut de page) : nextAt/nextId sont re-synchronisés avec le
  // bot toutes les 10s, le badge lui-même est décompté chaque seconde.
  let nextAt = 0;
  let nextId = null;

  function tickCountdown() {
    let badge = listEl.querySelector('.announce-item__countdown');
    const target = nextId ? listEl.querySelector(`.announce-item__remove[data-id="${nextId}"]`)?.closest('.announce-item') : null;

    if (!target) {
      badge?.remove();
      return;
    }
    if (!badge || badge.closest('.announce-item') !== target) {
      badge?.remove();
      badge = document.createElement('span');
      badge.className = 'announce-item__countdown';
      target.querySelector('.announce-item__text').insertAdjacentElement('afterend', badge);
    }
    badge.textContent = `⏱ ${formatCountdown(nextAt - Date.now())}`;
  }

  async function refreshSchedule() {
    try {
      const data = await fetchAnnounceSchedule();
      nextAt = data.nextAt;
      nextId = data.nextId;
      tickCountdown();
    } catch {
      // pas critique : le badge garde juste sa dernière valeur connue
    }
  }

  setInterval(tickCountdown, 1000);
  setInterval(refreshSchedule, 10_000);
  refreshSchedule();

  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    statusEl.textContent = 'Envoi en cours…';
    statusEl.className = 'status';

    try {
      const { sent } = await testAnnouncement();
      statusEl.textContent = sent ? `Envoyé dans le chat : "${sent.text}"` : 'Aucun message configuré à envoyer.';
    } catch (err) {
      statusEl.textContent = err instanceof Error ? err.message : 'Erreur inconnue';
      statusEl.className = 'status status--error';
    } finally {
      testBtn.disabled = false;
    }
  });

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

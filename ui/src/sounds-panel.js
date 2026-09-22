import { fetchSounds, uploadSound } from './api.js';

const CATEGORIES = [
  { value: 'all', label: 'ALL', hint: 'Tout le monde' },
  { value: 'sub', label: 'SUB', hint: 'Subs + modos + streamer' },
  { value: 'modo', label: 'MODO', hint: 'Modos + streamer' },
];

const DROPZONE_DEFAULT_TEXT = 'Glisse un fichier audio ici, ou clique pour parcourir';

function stripExtension(filename) {
  const i = filename.lastIndexOf('.');
  return i === -1 ? filename : filename.slice(0, i);
}

export function mountSoundsPanel(root) {
  root.innerHTML = `
    <div class="sounds-layout">
      <form id="upload-form" class="upload-card">
        <h2 class="upload-card__title">Ajouter un son</h2>

        <label class="field">
          <span class="field__label">Commande</span>
          <input id="command-input" type="text" placeholder="!boom" required autocomplete="off" />
        </label>

        <div class="field">
          <span class="field__label">Rôle minimum</span>
          <div class="segmented" id="category-select">
            ${CATEGORIES.map(
              (c, i) => `
              <button type="button" class="segmented__option${i === 0 ? ' is-active' : ''}" data-value="${c.value}" title="${c.hint}">${c.label}</button>
            `,
            ).join('')}
          </div>
        </div>

        <label id="dropzone" class="dropzone">
          <input id="file-input" type="file" accept="audio/*" required hidden />
          <span id="dropzone-text">${DROPZONE_DEFAULT_TEXT}</span>
        </label>

        <button type="submit" class="button button--primary">Ajouter</button>
        <p id="upload-status" class="status"></p>
      </form>

      <div class="sounds-groups" id="sounds-groups"></div>
    </div>
  `;

  const form = root.querySelector('#upload-form');
  const commandInput = root.querySelector('#command-input');
  const categorySelect = root.querySelector('#category-select');
  const fileInput = root.querySelector('#file-input');
  const dropzone = root.querySelector('#dropzone');
  const dropzoneText = root.querySelector('#dropzone-text');
  const uploadStatus = root.querySelector('#upload-status');
  const groupsEl = root.querySelector('#sounds-groups');

  let selectedCategory = CATEGORIES[0].value;

  categorySelect.addEventListener('click', (event) => {
    const btn = event.target.closest('.segmented__option');
    if (!btn) return;
    selectedCategory = btn.dataset.value;
    categorySelect
      .querySelectorAll('.segmented__option')
      .forEach((el) => el.classList.toggle('is-active', el === btn));
  });

  function handleFileSelected() {
    const file = fileInput.files[0];
    dropzoneText.textContent = file ? file.name : DROPZONE_DEFAULT_TEXT;
    if (file && !commandInput.value.trim()) {
      commandInput.value = `!${stripExtension(file.name)}`;
    }
  }

  fileInput.addEventListener('change', handleFileSelected);

  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('is-dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
    if (event.dataTransfer.files[0]) {
      fileInput.files = event.dataTransfer.files;
      handleFileSelected();
    }
  });

  function renderGroups(sounds) {
    groupsEl.innerHTML = CATEGORIES.map(({ value, label, hint }) => {
      const files = sounds[value] ?? [];
      const items = files.length
        ? files.map((f) => `<li class="chip">${stripExtension(f)}</li>`).join('')
        : '<li class="chip chip--empty">Aucun son</li>';
      return `
        <div class="sounds-group">
          <div class="sounds-group__header">
            <h3>${label}</h3>
            <span class="sounds-group__hint">${hint} · ${files.length}</span>
          </div>
          <ul class="chips">${items}</ul>
        </div>
      `;
    }).join('');
  }

  async function loadSounds() {
    try {
      renderGroups(await fetchSounds());
    } catch (err) {
      groupsEl.innerHTML = `<p class="status status--error">${err instanceof Error ? err.message : 'Erreur inconnue'}</p>`;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = fileInput.files[0];
    if (!file) return;

    uploadStatus.textContent = 'Envoi en cours…';
    uploadStatus.className = 'status';

    try {
      const result = await uploadSound({ category: selectedCategory, command: commandInput.value, file });
      uploadStatus.textContent = `${result.command} ajouté dans ${result.category}`;
      form.reset();
      dropzoneText.textContent = DROPZONE_DEFAULT_TEXT;
      await loadSounds();
    } catch (err) {
      uploadStatus.textContent = err instanceof Error ? err.message : 'Erreur inconnue';
      uploadStatus.className = 'status status--error';
    }
  });

  loadSounds();
}

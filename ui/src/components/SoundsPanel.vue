<template>
  <div class="sounds-layout">
    <div v-if="!editable" class="upload-card">
      <h2 class="upload-card__title">Overlay OBS</h2>
      <p class="status">
        Ajoute cette URL en Browser Source dans OBS : elle lit le chat et joue les sons,
        sans bot. Les modos peuvent taper <code>!sons off</code> / <code>!sons on</code>.
      </p>
      <button
        type="button"
        class="chip overlay-url"
        :class="{ 'chip--copied': overlayCopied }"
        @click="copyOverlayUrl"
      >{{ overlayCopied ? 'Copié !' : overlayUrl }}</button>

      <h2 class="upload-card__title">Ajouter un son</h2>
      <p class="status">
        Dépose le fichier sur GitHub dans le dossier du rôle voulu, nommé comme la
        commande (ex : <code>!boom.mp3</code>). Le site se met à jour en ~1 min,
        l'overlay le prend en compte dans les 5 min.
      </p>
      <div class="segmented">
        <a
          v-for="cat in CATEGORIES"
          :key="cat.value"
          class="segmented__option"
          :href="`https://github.com/${GITHUB_REPO}/upload/main/bot/sounds/${cat.value}`"
          :title="cat.hint"
          target="_blank"
          rel="noopener"
        >{{ cat.label }}</a>
      </div>
    </div>

    <form v-else class="upload-card" @submit.prevent="handleUpload">
      <h2 class="upload-card__title">Ajouter un son</h2>

      <label class="field">
        <span class="field__label">Commande</span>
        <input v-model="command" type="text" placeholder="!boom" required autocomplete="off" />
      </label>

      <div class="field">
        <span class="field__label">Rôle minimum</span>
        <div class="segmented">
          <button
            v-for="cat in CATEGORIES"
            :key="cat.value"
            type="button"
            class="segmented__option"
            :class="{ 'is-active': selectedCategory === cat.value }"
            :title="cat.hint"
            @click="selectedCategory = cat.value"
          >{{ cat.label }}</button>
        </div>
      </div>

      <label
        class="dropzone"
        :class="{ 'is-dragover': isDragover }"
        @dragover.prevent="isDragover = true"
        @dragleave="isDragover = false"
        @drop.prevent="handleDrop"
      >
        <input ref="fileInputEl" type="file" accept="audio/*" hidden @change="handleFileChange" />
        <span>{{ dropzoneText }}</span>
      </label>

      <button type="submit" class="button button--primary" :disabled="!selectedFile">Ajouter</button>
      <p class="status" :class="{ 'status--error': uploadError }">{{ uploadStatus }}</p>
    </form>

    <div class="sounds-groups">
      <p v-if="soundsError" class="status status--error">{{ soundsError }}</p>
      <template v-else>
        <div v-for="cat in CATEGORIES" :key="cat.value" class="sounds-group">
          <div class="sounds-group__header">
            <h3>{{ cat.label }}</h3>
            <span class="sounds-group__hint">{{ cat.hint }} · {{ (sounds[cat.value] ?? []).length }}</span>
          </div>
          <ul class="chips">
            <template v-if="(sounds[cat.value] ?? []).length">
              <li v-for="f in sounds[cat.value]" :key="f">
                <button
                  type="button"
                  class="chip"
                  :class="{ 'chip--copied': copiedFiles.has(f) }"
                  @click="copyCommand(f)"
                >{{ copiedFiles.has(f) ? 'Copié !' : stripExtension(f) }}</button>
              </li>
            </template>
            <li v-else class="chip chip--empty">Aucun son</li>
          </ul>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { fetchSounds, uploadSound } from '../js/api.js';

const CATEGORIES = [
  { value: 'all', label: 'ALL', hint: 'Tout le monde' },
  { value: 'sub', label: 'SUB', hint: 'Subs + modos + streamer' },
  { value: 'modo', label: 'MODO', hint: 'Modos + streamer' },
];

const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO ?? 'upFrontEnd/stream-inflight-command';
const TWITCH_CHANNEL = import.meta.env.VITE_TWITCH_CHANNEL ?? '';
const overlayUrl = new URL(
  `overlay.html${TWITCH_CHANNEL ? `?channel=${encodeURIComponent(TWITCH_CHANNEL)}` : ''}`,
  new URL(import.meta.env.BASE_URL, location.origin),
).href;

const DROPZONE_DEFAULT_TEXT = 'Glisse un fichier audio ici, ou clique pour parcourir';

function stripExtension(filename) {
  const i = filename.lastIndexOf('.');
  return i === -1 ? filename : filename.slice(0, i);
}

const fileInputEl = ref(null);
const selectedCategory = ref(CATEGORIES[0].value);
const command = ref('');
const selectedFile = ref(null);
const dropzoneText = ref(DROPZONE_DEFAULT_TEXT);
const isDragover = ref(false);
const uploadStatus = ref('');
const uploadError = ref(false);
const sounds = ref({});
const soundsError = ref('');
const copiedFiles = reactive(new Set());
const editable = ref(true);
const overlayCopied = ref(false);

async function copyOverlayUrl() {
  try {
    await navigator.clipboard.writeText(overlayUrl);
    overlayCopied.value = true;
    setTimeout(() => (overlayCopied.value = false), 1000);
  } catch (err) {
    console.error('Copie impossible :', err);
  }
}

function handleFileChange() {
  const file = fileInputEl.value?.files[0];
  selectedFile.value = file ?? null;
  dropzoneText.value = file ? file.name : DROPZONE_DEFAULT_TEXT;
  if (file && !command.value.trim()) {
    command.value = `!${stripExtension(file.name)}`;
  }
}

function handleDrop(event) {
  isDragover.value = false;
  const file = event.dataTransfer?.files[0];
  if (!file) return;
  selectedFile.value = file;
  dropzoneText.value = file.name;
  if (!command.value.trim()) {
    command.value = `!${stripExtension(file.name)}`;
  }
}

async function copyCommand(filename) {
  const cmd = stripExtension(filename);
  try {
    await navigator.clipboard.writeText(cmd);
    copiedFiles.add(filename);
    setTimeout(() => copiedFiles.delete(filename), 1000);
  } catch (err) {
    console.error('Copie impossible :', err);
  }
}

async function loadSounds() {
  try {
    const result = await fetchSounds();
    sounds.value = result.sounds;
    editable.value = result.editable;
    soundsError.value = '';
  } catch (err) {
    soundsError.value = err instanceof Error ? err.message : 'Erreur inconnue';
  }
}

async function handleUpload() {
  const file = selectedFile.value;
  if (!file) return;

  uploadStatus.value = 'Envoi en cours…';
  uploadError.value = false;

  try {
    const result = await uploadSound({ category: selectedCategory.value, command: command.value, file });
    uploadStatus.value = `${result.command} ajouté dans ${result.category}`;
    command.value = '';
    selectedFile.value = null;
    dropzoneText.value = DROPZONE_DEFAULT_TEXT;
    if (fileInputEl.value) fileInputEl.value.value = '';
    await loadSounds();
  } catch (err) {
    uploadStatus.value = err instanceof Error ? err.message : 'Erreur inconnue';
    uploadError.value = true;
  }
}

loadSounds();
</script>

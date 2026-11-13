<template>
  <div class="form-layout">
    <div class="form-layout__main">
      <p v-if="soundsError" class="notice notice--error" role="alert">
        <AdminIcon name="alert" :size="18" />
        <span>{{ soundsError }}</span>
        <button type="button" class="btn btn--sm" @click="loadSounds">
          <AdminIcon name="refresh" :size="16" />
          Recharger
        </button>
      </p>

      <template v-else>
        <section v-for="cat in CATEGORIES" :key="cat.value" class="card">
          <div class="card__header">
            <div>
              <h2 class="card__title">
                {{ cat.title }}
                <span class="badge badge--neutral">{{ (sounds[cat.value] ?? []).length }}</span>
              </h2>
              <p class="card__subtitle">{{ cat.hint }}</p>
            </div>
            <code class="sound-role">{{ cat.label }}</code>
          </div>
          <ul v-if="(sounds[cat.value] ?? []).length" class="chips">
            <li v-for="f in sounds[cat.value]" :key="f">
              <button
                type="button"
                class="chip chip--button"
                :class="{ 'chip--copied': copiedFiles.has(f) }"
                :title="`Copier ${stripExtension(f)}`"
                @click="copyCommand(f)"
              >
                <AdminIcon v-if="copiedFiles.has(f)" name="check" :size="14" />
                {{ copiedFiles.has(f) ? 'Copié' : stripExtension(f) }}
              </button>
            </li>
          </ul>
          <p v-else class="muted">Aucun son pour ce rôle.</p>
        </section>
      </template>
    </div>

    <aside class="form-layout__aside form-layout__aside--sticky">
      <template v-if="!editable">
        <section class="card">
          <div class="card__header">
            <div>
              <h2 class="card__title">Overlay OBS</h2>
              <p class="card__subtitle">URL de la source navigateur</p>
            </div>
          </div>
          <div class="input-group">
            <input class="input input--code" :value="overlayUrl" readonly aria-label="URL de l'overlay OBS" @focus="$event.target.select()" />
            <button type="button" class="input-group__btn" title="Copier" aria-label="Copier l'URL" @click="copyOverlayUrl">
              <AdminIcon :name="overlayCopied ? 'check' : 'copy'" :size="18" />
            </button>
          </div>
          <p class="hint">
            L'overlay lit le chat et joue les sons, sans bot. Les modos peuvent taper
            <code>!sons off</code> / <code>!sons on</code>.
          </p>
        </section>

        <section class="card">
          <div class="card__header">
            <div>
              <h2 class="card__title">Ajouter un son</h2>
              <p class="card__subtitle">Directement sur GitHub</p>
            </div>
          </div>
          <p class="muted card__text">
            Dépose le fichier dans le dossier du rôle voulu, nommé comme la commande
            (ex : <code>!boom.mp3</code>). Le site se met à jour en ~1 min, l'overlay
            le prend en compte dans les 5 min.
          </p>
          <div class="card__actions">
            <a
              v-for="cat in CATEGORIES"
              :key="cat.value"
              class="btn btn--block"
              :href="`https://github.com/${GITHUB_REPO}/upload/main/bot/sounds/${cat.value}`"
              target="_blank"
              rel="noopener"
            >
              <AdminIcon name="upload" :size="18" />
              Dossier {{ cat.label }}
            </a>
          </div>
        </section>
      </template>

      <form v-else class="card" @submit.prevent="handleUpload">
        <div class="card__header">
          <div>
            <h2 class="card__title">Ajouter un son</h2>
            <p class="card__subtitle">Enregistré par le bot local</p>
          </div>
        </div>

        <div class="fields">
          <div class="field">
            <label class="field__label" for="sound-command">Commande</label>
            <input id="sound-command" v-model="command" class="input input--code" type="text" placeholder="!boom" required autocomplete="off" />
          </div>

          <div class="field">
            <span class="field__label">Rôle minimum</span>
            <div class="segmented" role="radiogroup" aria-label="Rôle minimum">
              <button
                v-for="cat in CATEGORIES"
                :key="cat.value"
                type="button"
                role="radio"
                class="segmented__option"
                :class="{ 'is-active': selectedCategory === cat.value }"
                :aria-checked="selectedCategory === cat.value"
                :title="cat.hint"
                @click="selectedCategory = cat.value"
              >{{ cat.label }}</button>
            </div>
          </div>

          <label
            class="dropzone"
            :class="{ 'is-dragging': isDragover, 'has-image': selectedFile }"
            tabindex="0"
            @dragover.prevent="isDragover = true"
            @dragleave="isDragover = false"
            @drop.prevent="handleDrop"
            @keydown.enter.prevent="fileInputEl?.click()"
          >
            <input ref="fileInputEl" type="file" accept="audio/*" hidden @change="handleFileChange" />
            <span class="dropzone__icon"><AdminIcon :name="selectedFile ? 'volume' : 'upload'" /></span>
            <span class="dropzone__text">
              <strong>{{ selectedFile ? selectedFile.name : 'Glisse un fichier audio ici' }}</strong>
              <span>{{ selectedFile ? 'Clique pour changer de fichier' : 'ou clique pour parcourir' }}</span>
            </span>
          </label>
        </div>

        <div class="card__actions">
          <button type="submit" class="btn btn--primary btn--block" :disabled="!selectedFile || uploading">
            <AdminIcon name="plus" :size="18" />
            {{ uploading ? 'Envoi…' : 'Ajouter' }}
          </button>
          <Transition name="fade">
            <p v-if="uploadStatus" class="status" :class="uploadError ? 'status--error' : 'status--success'" role="status">
              <AdminIcon :name="uploadError ? 'alert' : 'check'" :size="16" />
              {{ uploadStatus }}
            </p>
          </Transition>
        </div>
      </form>
    </aside>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { fetchSounds, uploadSound } from '../js/api.js';
import AdminIcon from './AdminIcon.vue';

const CATEGORIES = [
  { value: 'all', label: 'ALL', title: 'Tout le monde', hint: 'Utilisables par tous les viewers' },
  { value: 'sub', label: 'SUB', title: 'Abonnés', hint: 'Subs + modos + streamer' },
  { value: 'modo', label: 'MODO', title: 'Modérateurs', hint: 'Modos + streamer' },
];

const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO ?? 'upFrontEnd/stream-inflight-command';
const TWITCH_CHANNEL = import.meta.env.VITE_TWITCH_CHANNEL ?? '';
const overlayUrl = new URL(
  `overlay.html${TWITCH_CHANNEL ? `?channel=${encodeURIComponent(TWITCH_CHANNEL)}` : ''}`,
  new URL(import.meta.env.BASE_URL, location.origin),
).href;

function stripExtension(filename) {
  const i = filename.lastIndexOf('.');
  return i === -1 ? filename : filename.slice(0, i);
}

const fileInputEl = ref(null);
const selectedCategory = ref(CATEGORIES[0].value);
const command = ref('');
const selectedFile = ref(null);
const isDragover = ref(false);
const uploading = ref(false);
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
    setTimeout(() => (overlayCopied.value = false), 1500);
  } catch (err) {
    console.error('Copie impossible :', err);
  }
}

function selectFile(file) {
  selectedFile.value = file;
  if (!command.value.trim()) {
    command.value = `!${stripExtension(file.name)}`;
  }
}

function handleFileChange() {
  const file = fileInputEl.value?.files[0];
  if (file) selectFile(file);
}

function handleDrop(event) {
  isDragover.value = false;
  const file = event.dataTransfer?.files[0];
  if (file) selectFile(file);
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

  uploading.value = true;
  uploadStatus.value = '';
  uploadError.value = false;

  try {
    const result = await uploadSound({ category: selectedCategory.value, command: command.value, file });
    uploadStatus.value = `${result.command} ajouté dans ${result.category}`;
    command.value = '';
    selectedFile.value = null;
    if (fileInputEl.value) fileInputEl.value.value = '';
    await loadSounds();
  } catch (err) {
    uploadStatus.value = err instanceof Error ? err.message : 'Erreur inconnue';
    uploadError.value = true;
  } finally {
    uploading.value = false;
  }
}

loadSounds();
</script>

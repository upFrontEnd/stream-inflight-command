<template>
  <div v-if="!editable" class="upload-card">
    <h2 class="upload-card__title">Annonces via GitHub Actions</h2>
    <p class="status">
      Sans bot, les messages sont envoyés par GitHub Actions : toutes les
      {{ ANNOUNCE_INTERVAL_MINUTES }} min une fois le live détecté, en rotation.
      La liste se modifie dans <code>bot/announcements.json</code> sur GitHub.
    </p>
    <div class="panel__toolbar">
      <a class="button" :href="`https://github.com/${GITHUB_REPO}/edit/main/bot/announcements.json`" target="_blank" rel="noopener">Modifier la liste</a>
      <a class="button" :href="`https://github.com/${GITHUB_REPO}/actions/workflows/announce.yml`" target="_blank" rel="noopener">Tester maintenant</a>
    </div>
    <p class="status">« Tester maintenant » ouvre la page de l'Action : clique sur « Run workflow ».</p>
  </div>

  <template v-else>
  <p class="status">{{ liveText }}</p>
  <div class="panel__toolbar">
    <button type="button" class="button" :disabled="testLoading" @click="handleTest">Tester maintenant</button>
  </div>

  <form class="upload-card" @submit.prevent="handleAdd">
    <h2 class="upload-card__title">Ajouter un message</h2>
    <label class="field">
      <span class="field__label">Texte</span>
      <textarea v-model="newText" rows="2" placeholder="Rejoins le Discord : ..." required></textarea>
    </label>
    <button type="submit" class="button button--primary">Ajouter</button>
    <p class="status" :class="{ 'status--error': actionError }">{{ actionStatus }}</p>
  </form>
  </template>

  <ul class="announce-list">
    <template v-if="announcements.length && !listError">
      <li
        v-for="(item, i) in announcements"
        :key="item.id ?? i"
        class="announce-item"
        :class="{ 'announce-item--editing': item.id === editingId }"
      >
        <template v-if="item.id === editingId">
          <textarea class="announce-item__edit-input" rows="2" v-model="editText"></textarea>
          <span class="announce-item__actions">
            <button type="button" class="announce-item__save" @click="saveEdit(item.id)">Enregistrer</button>
            <button type="button" class="announce-item__cancel" @click="cancelEdit">Annuler</button>
          </span>
        </template>
        <template v-else>
          <span class="announce-item__text">{{ item.text }}</span>
          <span v-if="item.id === nextId" class="announce-item__countdown">⏱ {{ countdown }}</span>
          <span v-if="editable" class="announce-item__actions">
            <button type="button" class="announce-item__edit" title="Modifier" aria-label="Modifier" @click="startEdit(item.id, item.text)">✏️</button>
            <button type="button" class="announce-item__remove" title="Supprimer" aria-label="Supprimer" @click="removeItem(item.id)">✕</button>
          </span>
        </template>
      </li>
    </template>
    <li v-else-if="listError" class="status status--error">{{ listError }}</li>
    <li v-else class="status">Aucun message pour l'instant.</li>
  </ul>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import {
  fetchAnnouncements,
  addAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  fetchAnnounceSchedule,
  testAnnouncement,
} from '../js/api.js';

const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO ?? 'upFrontEnd/stream-inflight-command';
const ANNOUNCE_INTERVAL_MINUTES = import.meta.env.VITE_ANNOUNCE_INTERVAL_MINUTES ?? '30';

function formatCountdown(ms) {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const announcements = ref([]);
const editable = ref(true);
const listError = ref('');
const editingId = ref(null);
const editText = ref('');
const newText = ref('');
const actionStatus = ref('');
const actionError = ref(false);
const testLoading = ref(false);
const liveText = ref('');
const nextAt = ref(0);
const nextId = ref(null);
const countdown = ref('00:00');

let tickTimer = null;
let scheduleTimer = null;

async function loadList() {
  try {
    const result = await fetchAnnouncements();
    announcements.value = result.list;
    editable.value = result.editable;
    listError.value = '';
  } catch (err) {
    listError.value = err instanceof Error ? err.message : 'Erreur inconnue';
  }
}

function tickCountdown() {
  countdown.value = formatCountdown(nextAt.value - Date.now());
}

async function refreshSchedule() {
  if (!editable.value) return;
  try {
    const data = await fetchAnnounceSchedule();
    nextAt.value = data.nextAt;
    nextId.value = data.nextId;
    liveText.value = data.live
      ? '🔴 En live : les annonces tournent automatiquement.'
      : '⚫ Hors live : les annonces automatiques reprendront dès la détection du live. "Tester maintenant" fonctionne quand même.';
    tickCountdown();
  } catch {
    // non-critical
  }
}

function startEdit(id, text) {
  editingId.value = id;
  editText.value = text;
}

function cancelEdit() {
  editingId.value = null;
  editText.value = '';
}

async function saveEdit(id) {
  const text = editText.value.trim();
  if (!text) return;
  try {
    await updateAnnouncement(id, text);
    cancelEdit();
    await loadList();
  } catch (err) {
    actionStatus.value = err instanceof Error ? err.message : 'Erreur inconnue';
    actionError.value = true;
  }
}

async function removeItem(id) {
  try {
    await deleteAnnouncement(id);
    if (editingId.value === id) cancelEdit();
    await loadList();
  } catch (err) {
    actionStatus.value = err instanceof Error ? err.message : 'Erreur inconnue';
    actionError.value = true;
  }
}

async function handleAdd() {
  const text = newText.value.trim();
  if (!text) return;
  actionStatus.value = 'Ajout en cours…';
  actionError.value = false;
  try {
    await addAnnouncement(text);
    newText.value = '';
    actionStatus.value = 'Message ajouté.';
    await loadList();
  } catch (err) {
    actionStatus.value = err instanceof Error ? err.message : 'Erreur inconnue';
    actionError.value = true;
  }
}

async function handleTest() {
  testLoading.value = true;
  actionStatus.value = 'Envoi en cours…';
  actionError.value = false;
  try {
    const { sent } = await testAnnouncement();
    actionStatus.value = sent
      ? `Envoyé dans le chat : "${sent.text}"`
      : 'Aucun message configuré à envoyer.';
  } catch (err) {
    actionStatus.value = err instanceof Error ? err.message : 'Erreur inconnue';
    actionError.value = true;
  } finally {
    testLoading.value = false;
  }
}

onMounted(async () => {
  await loadList();
  refreshSchedule();
  tickTimer = setInterval(tickCountdown, 1000);
  scheduleTimer = setInterval(refreshSchedule, 10_000);
});

onUnmounted(() => {
  clearInterval(tickTimer);
  clearInterval(scheduleTimer);
});
</script>

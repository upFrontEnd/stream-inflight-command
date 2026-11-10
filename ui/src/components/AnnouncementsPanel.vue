<template>
  <form v-if="mode === 'readonly'" class="upload-card" @submit.prevent="handleConnect">
    <h2 class="upload-card__title">Connecter GitHub pour modifier les annonces</h2>
    <p class="status">
      Sans bot, les messages sont envoyés par GitHub Actions (toutes les
      {{ ANNOUNCE_INTERVAL_MINUTES }} min pendant le live). Pour les modifier ici, le
      dashboard a besoin d'un jeton GitHub, à créer une seule fois :
    </p>
    <ol class="steps">
      <li><a :href="TOKEN_CREATE_URL" target="_blank" rel="noopener">Ouvre la page de création du jeton</a></li>
      <li>« Repository access » : <strong>Only select repositories</strong> → <code>{{ REPO_NAME }}</code></li>
      <li>« Permissions » : <strong>Contents</strong> et <strong>Actions</strong> en « Read and write » (normalement déjà cochés)</li>
      <li>« Generate token », puis colle-le ci-dessous</li>
    </ol>
    <label class="field">
      <span class="field__label">Jeton GitHub</span>
      <input v-model="tokenInput" type="text" placeholder="github_pat_…" required autocomplete="off" spellcheck="false" />
    </label>
    <button type="submit" class="button button--primary" :disabled="connecting">Connecter</button>
    <p class="status">Le jeton reste uniquement dans ce navigateur.</p>
    <p class="status" :class="{ 'status--error': actionError }">{{ actionStatus }}</p>
  </form>

  <template v-else>
    <p class="status">{{ liveText }}</p>
    <div class="panel__toolbar">
      <button type="button" class="button" :disabled="testLoading" @click="handleTest">Tester maintenant</button>
      <button v-if="mode === 'github'" type="button" class="button button--ghost" @click="handleDisconnect">Déconnecter GitHub</button>
    </div>

    <form class="upload-card" @submit.prevent="handleAdd">
      <h2 class="upload-card__title">Ajouter un message</h2>
      <label class="field">
        <span class="field__label">Texte</span>
        <textarea v-model="newText" rows="2" placeholder="Rejoins le Discord : ..." maxlength="450" required></textarea>
      </label>
      <button type="submit" class="button button--primary" :disabled="saving">Ajouter</button>
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
            <button type="button" class="announce-item__save" :disabled="saving" @click="saveEdit(item.id)">Enregistrer</button>
            <button type="button" class="announce-item__cancel" @click="cancelEdit">Annuler</button>
          </span>
        </template>
        <template v-else>
          <span class="announce-item__text">{{ item.text }}</span>
          <span v-if="item.id === nextId" class="announce-item__countdown">⏱ {{ countdown }}</span>
          <span v-if="mode !== 'readonly'" class="announce-item__actions">
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
import { TOKEN_CREATE_URL, setGithubToken, verifyGithubToken } from '../js/github-announcements.js';

const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO ?? 'upFrontEnd/stream-inflight-command';
const REPO_NAME = GITHUB_REPO.split('/')[1];
const ANNOUNCE_INTERVAL_MINUTES = import.meta.env.VITE_ANNOUNCE_INTERVAL_MINUTES ?? '30';
const GITHUB_LIVE_TEXT =
  'Enregistré sur GitHub : chaque modification est prise en compte à l\'envoi suivant. ' +
  `Les annonces partent toutes les ${ANNOUNCE_INTERVAL_MINUTES} min pendant le live.`;

function formatCountdown(ms) {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const announcements = ref([]);
const mode = ref('readonly');
const tokenInput = ref('');
const connecting = ref(false);
const saving = ref(false);
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
    mode.value = result.mode;
    listError.value = '';
    if (mode.value === 'github') liveText.value = GITHUB_LIVE_TEXT;
  } catch (err) {
    listError.value = err instanceof Error ? err.message : 'Erreur inconnue';
  }
}

function tickCountdown() {
  countdown.value = formatCountdown(nextAt.value - Date.now());
}

async function refreshSchedule() {
  if (mode.value !== 'bot') return;
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

// En mode GitHub, chaque action est un commit (1 à 2 s) : on bloque les
// boutons pendant ce temps pour éviter deux écritures en parallèle.
async function runAction(pendingText, action, doneText) {
  if (saving.value) return false;
  saving.value = true;
  actionStatus.value = pendingText;
  actionError.value = false;
  try {
    await action();
    actionStatus.value = doneText;
    await loadList();
    return true;
  } catch (err) {
    actionStatus.value = err instanceof Error ? err.message : 'Erreur inconnue';
    actionError.value = true;
    return false;
  } finally {
    saving.value = false;
  }
}

async function saveEdit(id) {
  const text = editText.value.trim();
  if (!text) return;
  if (await runAction('Enregistrement…', () => updateAnnouncement(id, text), 'Message modifié.')) cancelEdit();
}

async function removeItem(id) {
  if (!confirm('Supprimer ce message ?')) return;
  const removed = await runAction('Suppression…', () => deleteAnnouncement(id), 'Message supprimé.');
  if (removed && editingId.value === id) cancelEdit();
}

async function handleAdd() {
  const text = newText.value.trim();
  if (!text) return;
  if (await runAction('Ajout en cours…', () => addAnnouncement(text), 'Message ajouté.')) newText.value = '';
}

async function handleConnect() {
  const token = tokenInput.value.trim();
  if (!token) return;
  connecting.value = true;
  actionStatus.value = 'Vérification du jeton…';
  actionError.value = false;
  try {
    await verifyGithubToken(token);
    setGithubToken(token);
    tokenInput.value = '';
    actionStatus.value = '';
    await loadList();
  } catch (err) {
    actionStatus.value = err instanceof Error ? err.message : 'Erreur inconnue';
    actionError.value = true;
  } finally {
    connecting.value = false;
  }
}

async function handleDisconnect() {
  setGithubToken('');
  actionStatus.value = '';
  await loadList();
}

async function handleTest() {
  testLoading.value = true;
  actionStatus.value = 'Envoi en cours…';
  actionError.value = false;
  try {
    const { sent, dispatched } = await testAnnouncement();
    if (dispatched) {
      actionStatus.value = 'Envoi lancé sur GitHub : le message arrive dans le chat dans ~30 s.';
    } else {
      actionStatus.value = sent ? `Envoyé dans le chat : "${sent.text}"` : 'Aucun message configuré à envoyer.';
    }
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

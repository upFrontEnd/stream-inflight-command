<template>
  <Transition name="fade">
    <p v-if="actionStatus" class="notice" :class="`notice--${noticeTone}`" role="status">
      <span v-if="noticeTone === 'info'" class="spinner" aria-hidden="true"></span>
      <AdminIcon v-else :name="noticeTone === 'error' ? 'alert' : 'check'" :size="18" />
      <span>{{ actionStatus }}</span>
      <button type="button" class="icon-btn notice__close" aria-label="Masquer" @click="actionStatus = ''">
        <AdminIcon name="close" :size="16" />
      </button>
    </p>
  </Transition>

  <div class="form-layout">
    <div class="form-layout__main">
      <section class="card">
        <div class="card__header">
          <div>
            <h2 class="card__title">
              Messages
              <span class="badge badge--neutral">{{ announcements.length }}</span>
            </h2>
            <p class="card__subtitle">Postés à tour de rôle, dans cet ordre</p>
          </div>
        </div>

        <p v-if="listError" class="status status--error">
          <AdminIcon name="alert" :size="16" />
          {{ listError }}
        </p>
        <div v-else-if="!announcements.length" class="empty">
          <AdminIcon name="megaphone" :size="28" />
          <span>Aucun message pour l'instant.</span>
        </div>
        <ul v-else class="announce-list">
          <li
            v-for="(item, i) in announcements"
            :key="item.id ?? i"
            class="announce"
            :class="{ 'announce--editing': item.id === editingId, 'announce--next': item.id === nextId }"
          >
            <span class="announce__index">{{ i + 1 }}</span>

            <template v-if="item.id === editingId">
              <div class="announce__editor">
                <textarea v-model="editText" class="input" rows="3" maxlength="450" aria-label="Texte du message"></textarea>
                <div class="announce__editor-actions">
                  <button type="button" class="btn btn--sm btn--ghost" @click="cancelEdit">Annuler</button>
                  <button type="button" class="btn btn--sm btn--primary" :disabled="saving || !editText.trim()" @click="saveEdit(item.id)">
                    <AdminIcon name="check" :size="16" />
                    Enregistrer
                  </button>
                </div>
              </div>
            </template>

            <template v-else>
              <p class="announce__text">{{ item.text }}</p>
              <span v-if="item.id === nextId" class="badge badge--accent announce__countdown" title="Prochain envoi">
                <AdminIcon name="clock" :size="14" />
                {{ countdown }}
              </span>
              <span v-if="mode !== 'readonly'" class="announce__actions">
                <button type="button" class="icon-btn" title="Modifier" aria-label="Modifier" :disabled="saving" @click="startEdit(item.id, item.text)">
                  <AdminIcon name="pencil" :size="18" />
                </button>
                <button type="button" class="icon-btn icon-btn--danger" title="Supprimer" aria-label="Supprimer" :disabled="saving" @click="removeItem(item.id)">
                  <AdminIcon name="trash" :size="18" />
                </button>
              </span>
            </template>
          </li>
        </ul>
      </section>
    </div>

    <aside class="form-layout__aside form-layout__aside--sticky">
      <form v-if="mode === 'readonly'" class="card" @submit.prevent="handleConnect">
        <div class="card__header">
          <div>
            <h2 class="card__title">Connecter GitHub</h2>
            <p class="card__subtitle">Pour modifier les annonces sans bot</p>
          </div>
        </div>
        <p class="muted card__text">
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
        <div class="field">
          <label class="field__label" for="github-token">Jeton GitHub</label>
          <input id="github-token" v-model="tokenInput" class="input input--code" type="text" placeholder="github_pat_…" required autocomplete="off" spellcheck="false" />
          <span class="field__hint">Le jeton reste uniquement dans ce navigateur.</span>
        </div>
        <div class="card__actions">
          <button type="submit" class="btn btn--primary btn--block" :disabled="connecting">
            <AdminIcon name="key" :size="18" />
            {{ connecting ? 'Vérification…' : 'Connecter' }}
          </button>
        </div>
      </form>

      <template v-else>
        <section class="card">
          <div class="card__header">
            <div>
              <h2 class="card__title">
                Diffusion
                <span v-if="mode === 'bot' && live !== null" class="badge" :class="live ? 'badge--success' : 'badge--neutral'">
                  {{ live ? 'En live' : 'Hors live' }}
                </span>
                <span v-else-if="mode === 'github'" class="badge badge--neutral">GitHub Actions</span>
              </h2>
              <p class="card__subtitle">{{ mode === 'bot' ? 'Envoyées par le bot local' : 'Envoyées sans bot' }}</p>
            </div>
          </div>
          <p class="muted card__text">{{ liveText }}</p>
          <div class="card__actions">
            <button type="button" class="btn btn--block" :disabled="testLoading" @click="handleTest">
              <AdminIcon name="send" :size="18" />
              Tester maintenant
            </button>
            <button v-if="mode === 'github'" type="button" class="btn btn--ghost btn--block" @click="handleDisconnect">
              <AdminIcon name="logout" :size="18" />
              Déconnecter GitHub
            </button>
          </div>
        </section>

        <form class="card" @submit.prevent="handleAdd">
          <div class="card__header">
            <div>
              <h2 class="card__title">Ajouter un message</h2>
              <p class="card__subtitle">Ajouté en fin de liste</p>
            </div>
          </div>
          <div class="field">
            <label class="field__label" for="announce-text">Texte</label>
            <textarea id="announce-text" v-model="newText" class="input" rows="3" placeholder="Rejoins le Discord : ..." maxlength="450" required></textarea>
            <span class="field__hint">{{ newText.length }} / 450</span>
          </div>
          <div class="card__actions">
            <button type="submit" class="btn btn--primary btn--block" :disabled="saving || !newText.trim()">
              <AdminIcon name="plus" :size="18" />
              Ajouter
            </button>
          </div>
        </form>
      </template>
    </aside>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  fetchAnnouncements,
  addAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  fetchAnnounceSchedule,
  testAnnouncement,
} from '../js/api.js';
import { TOKEN_CREATE_URL, setGithubToken, verifyGithubToken } from '../js/github-announcements.js';
import AdminIcon from './AdminIcon.vue';

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
const live = ref(null);
const nextAt = ref(0);
const nextId = ref(null);
const countdown = ref('00:00');

// Couleur du bandeau : neutre (avec spinner) pendant l'action, puis vert ou rouge.
const noticeTone = computed(() => {
  if (actionError.value) return 'error';
  if (saving.value || testLoading.value || connecting.value) return 'info';
  return 'success';
});

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
    live.value = Boolean(data.live);
    liveText.value = data.live
      ? 'Les annonces tournent automatiquement dans le chat.'
      : 'Les annonces automatiques reprendront dès la détection du live. « Tester maintenant » fonctionne quand même.';
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

<template>
  <div class="vol">
    <div class="toolbar">
      <button class="btn" type="button" :disabled="loading" @click="load">
        <AdminIcon name="refresh" :size="18" :class="{ 'is-spinning': loading }" />
        Rafraîchir
      </button>
      <span class="status" :class="{ 'status--error': statusError }">
        <AdminIcon v-if="statusError" name="alert" :size="16" />
        {{ statusText }}
      </span>
    </div>

    <div class="command-grid">
      <article v-for="cmd in COMMANDS" :key="cmd.key" class="card command">
        <div class="command__header">
          <code class="command__name">{{ cmd.label }}</code>
          <span class="badge" :class="`badge--${BADGES[statusOf(cmd.key)].tone}`">
            {{ BADGES[statusOf(cmd.key)].text }}
          </span>
        </div>
        <p class="command__text" :class="{ muted: !cards[cmd.key]?.text }">
          {{ cards[cmd.key]?.text || (loaded ? 'Aucune réponse.' : 'Chargement…') }}
        </p>
      </article>
    </div>

    <details class="card raw">
      <summary class="raw__summary">
        <AdminIcon name="code" :size="18" />
        <span>Données brutes SimBrief</span>
        <AdminIcon name="chevron" :size="18" class="raw__chevron" />
      </summary>
      <pre class="raw__json">{{ rawJson || 'Aucune donnée.' }}</pre>
    </details>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { fetchPreview } from '../js/api.js';
import AdminIcon from './AdminIcon.vue';

const COMMANDS = [
  { key: 'vol', label: '!vol' },
  { key: 'appareil', label: '!appareil' },
  { key: 'plandevol', label: '!plandevol' },
  { key: 'meteo', label: '!meteo' },
  { key: 'eta', label: '!eta' },
];

const BADGES = {
  pending: { text: 'Chargement', tone: 'neutral' },
  ok: { text: 'OK', tone: 'success' },
  standby: { text: 'Stand by', tone: 'warning' },
  error: { text: 'Erreur', tone: 'danger' },
};

const cards = ref({});
const rawJson = ref('');
const loading = ref(false);
const loaded = ref(false);
const statusText = ref('');
const statusError = ref(false);

function statusOf(key) {
  if (!loaded.value) return 'pending';
  const entry = cards.value[key];
  if (!entry) return 'error';
  return entry.status ?? (entry.ok ? 'ok' : 'error');
}

async function load() {
  statusText.value = 'Chargement…';
  statusError.value = false;
  loading.value = true;
  try {
    const data = await fetchPreview();
    cards.value = data;
    rawJson.value = JSON.stringify(data.raw, null, 2);
    statusText.value = `Mis à jour à ${new Date().toLocaleTimeString('fr-FR')}`;
  } catch (err) {
    statusText.value = err instanceof Error ? err.message : 'Erreur inconnue';
    statusError.value = true;
  } finally {
    loading.value = false;
    loaded.value = true;
  }
}

load();
</script>

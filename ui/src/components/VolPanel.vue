<template>
  <div class="panel__toolbar">
    <button class="button" type="button" :disabled="loading" @click="load">Rafraîchir</button>
    <span class="status" :class="{ 'status--error': statusError }">{{ statusText }}</span>
  </div>
  <section class="cards">
    <article
      v-for="cmd in COMMANDS"
      :key="cmd.key"
      class="card"
      :class="`card--${statusOf(cards[cmd.key])}`"
    >
      <div class="card__header">
        <span class="card__command">{{ cmd.label }}</span>
        <span class="card__badge">{{ BADGE_TEXT[statusOf(cards[cmd.key])] }}</span>
      </div>
      <p class="card__text">{{ cards[cmd.key]?.text ?? '' }}</p>
    </article>
  </section>
  <details class="raw-panel">
    <summary>Données brutes SimBrief</summary>
    <pre>{{ rawJson }}</pre>
  </details>
</template>

<script setup>
import { ref } from 'vue';
import { fetchPreview } from '../js/api.js';

const COMMANDS = [
  { key: 'vol', label: '!vol' },
  { key: 'appareil', label: '!appareil' },
  { key: 'plandevol', label: '!plandevol' },
  { key: 'meteo', label: '!meteo' },
  { key: 'eta', label: '!eta' },
];

const BADGE_TEXT = { ok: 'OK', standby: 'STAND BY', error: 'Erreur' };

const cards = ref({});
const rawJson = ref('');
const loading = ref(false);
const statusText = ref('');
const statusError = ref(false);

function statusOf(entry) {
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
  }
}

load();
</script>

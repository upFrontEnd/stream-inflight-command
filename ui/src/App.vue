<template>
  <main class="app">
    <header class="app__header">
      <div class="app__brand">
        <img :src="logoUrl" alt="Skyflyer Aviation" class="app__logo" />
      </div>
      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tabs__item"
          :class="{ 'is-active': activeTab === tab.id }"
          type="button"
          @click="showTab(tab.id)"
        >
          <span class="icon-badge" v-html="tab.icon"></span>
          {{ tab.label }}
        </button>
      </nav>
    </header>
    <section class="panel" :hidden="activeTab !== 'vol'">
      <VolPanel v-if="mountedTabs.has('vol')" />
    </section>
    <section class="panel" :hidden="activeTab !== 'sons'">
      <SoundsPanel v-if="mountedTabs.has('sons')" />
    </section>
    <section class="panel" :hidden="activeTab !== 'annonces'">
      <AnnouncementsPanel v-if="mountedTabs.has('annonces')" />
    </section>
  </main>
</template>

<script setup>
import { ref, reactive } from 'vue';
import logoUrl from './img/logo_Lettre-1-V2-blanc.png';
import VolPanel from './components/VolPanel.vue';
import SoundsPanel from './components/SoundsPanel.vue';
import AnnouncementsPanel from './components/AnnouncementsPanel.vue';

const PLANE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
const SOUND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
const MESSAGE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

const tabs = [
  { id: 'vol', label: 'Vol', icon: PLANE_ICON },
  { id: 'sons', label: 'Sons', icon: SOUND_ICON },
  { id: 'annonces', label: 'Annonces', icon: MESSAGE_ICON },
];

const activeTab = ref('vol');
const mountedTabs = reactive(new Set(['vol']));

function showTab(id) {
  activeTab.value = id;
  mountedTabs.add(id);
}
</script>

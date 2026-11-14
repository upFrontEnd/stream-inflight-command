<template>
  <div class="admin">
    <div class="shell" :class="{ 'shell--nav-open': sidebarOpen }">
      <aside class="sidebar" aria-label="Navigation du dashboard">
        <div class="sidebar__brand">
          <img class="sidebar__logo" :src="logoUrl" alt="" width="40" height="40" />
          <div>
            <p class="sidebar__name">Skyflyer Aviation</p>
            <p class="sidebar__role">Commandes du stream</p>
          </div>
        </div>

        <nav class="sidebar__nav">
          <div v-for="group in navGroups" :key="group.title ?? 'main'" class="sidebar__group">
            <p v-if="group.title" class="sidebar__group-title">{{ group.title }}</p>
            <a
              v-for="p in group.pages"
              :key="p.key"
              :href="`#${p.key}`"
              class="sidebar__link"
              :class="[{ 'sidebar__link--active': p.key === page.key }, `tone-${p.tone}`]"
              :aria-current="p.key === page.key ? 'page' : undefined"
              @click.prevent="navigate(p.key)"
            >
              <AdminIcon :name="p.icon" class="sidebar__icon" />
              <span class="sidebar__label">{{ p.label }}</span>
            </a>
          </div>
        </nav>

        <div class="sidebar__footer">
          <a class="sidebar__link" :href="overlayUrl" target="_blank" rel="noopener">
            <AdminIcon name="external" class="sidebar__icon" />
            <span>Ouvrir l'overlay sons</span>
          </a>
          <a class="sidebar__link" :href="`https://github.com/${GITHUB_REPO}`" target="_blank" rel="noopener">
            <AdminIcon name="code" class="sidebar__icon" />
            <span>Repo GitHub</span>
          </a>
          <a class="sidebar__link" :href="SITE_ADMIN_URL">
            <AdminIcon name="home" class="sidebar__icon" />
            <span>Retour à l'admin du site</span>
          </a>
        </div>
      </aside>

      <div class="shell__scrim" @click="sidebarOpen = false"></div>

      <div class="shell__main">
        <header class="topbar">
          <button class="icon-btn topbar__menu" type="button" aria-label="Ouvrir le menu" @click="sidebarOpen = true">
            <AdminIcon name="menu" />
          </button>
          <AdminIcon :name="page.icon" class="topbar__icon" />
          <span class="topbar__title">{{ page.label }}</span>
        </header>

        <main class="page">
          <header class="page__header">
            <h1 class="page__title">{{ page.label }}</h1>
            <p class="page__lead">{{ page.description }}</p>
          </header>

          <!-- Une page n'est montée qu'à sa première ouverture, puis gardée
               (masquée) : on ne recharge pas les données à chaque changement. -->
          <template v-for="p in PAGES" :key="p.key">
            <section v-if="mounted.has(p.key)" v-show="p.key === page.key">
              <component :is="p.component" />
            </section>
          </template>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, markRaw, reactive, ref, watch } from 'vue';
import logoUrl from './img/logo.webp';
import AdminIcon from './components/AdminIcon.vue';
import VolPanel from './components/VolPanel.vue';
import SoundsPanel from './components/SoundsPanel.vue';
import AnnouncementsPanel from './components/AnnouncementsPanel.vue';
import { useAdminNav } from './js/use-admin-nav.js';

const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO ?? 'upFrontEnd/stream-inflight-command';
const SITE_ADMIN_URL = 'https://www.skyflyer-aviation.com/admin.html';
const TWITCH_CHANNEL =import.meta.env.VITE_TWITCH_CHANNEL ?? '';
const overlayUrl = `${import.meta.env.BASE_URL}overlay.html${TWITCH_CHANNEL ? `?channel=${encodeURIComponent(TWITCH_CHANNEL)}` : ''}`;

// Une entrée = une page du dashboard. La clé sert aussi d'ancre dans l'URL.
// `tone` donne la couleur de l'icône dans la barre latérale.
const PAGES = [
  {
    key: 'vol',
    group: 'Commandes du chat',
    label: 'Vol',
    icon: 'plane',
    tone: 'blue',
    description: 'Ce que répondent !vol, !appareil, !plandevol, !meteo et !eta, d\'après le plan de vol SimBrief du jour.',
    component: markRaw(VolPanel),
  },
  {
    key: 'sons',
    group: 'Commandes du chat',
    label: 'Sons',
    icon: 'volume',
    tone: 'violet',
    description: 'Les commandes son, classées par rôle minimum. Clique sur une commande pour la copier.',
    component: markRaw(SoundsPanel),
  },
  {
    key: 'annonces',
    group: 'Messages automatiques',
    label: 'Annonces',
    icon: 'megaphone',
    tone: 'orange',
    description: 'Les messages postés à tour de rôle dans le chat pendant le live.',
    component: markRaw(AnnouncementsPanel),
  },
];

const { current, go } = useAdminNav();

// Ancre inconnue ou vide : première page.
const page = computed(() => PAGES.find((p) => p.key === current.value) ?? PAGES[0]);

// Pages regroupées par section de la barre latérale, dans l'ordre de PAGES.
const navGroups = computed(() => {
  const groups = [];
  for (const p of PAGES) {
    let group = groups.find((g) => g.title === p.group);
    if (!group) groups.push((group = { title: p.group, pages: [] }));
    group.pages.push(p);
  }
  return groups;
});

const mounted = reactive(new Set());

// Sur mobile, la barre latérale devient un tiroir : on le referme dès
// qu'une page est choisie.
const sidebarOpen = ref(false);
function navigate(key) {
  go(key);
  sidebarOpen.value = false;
}

watch(page, (p) => {
  mounted.add(p.key);
  document.title = `${p.label} · Commandes du stream`;
  document.querySelector('.shell__main')?.scrollTo({ top: 0 });
}, { immediate: true });
</script>

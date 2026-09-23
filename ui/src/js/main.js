import '../scss/style.scss';
import { mountVolPanel } from './vol-panel.js';
import { mountSoundsPanel } from './sounds-panel.js';
import { mountAnnouncementsPanel } from './announcements-panel.js';
import { PLANE_ICON, SOUND_ICON, MESSAGE_ICON } from './icons.js';
import logoUrl from '../img/logo_Lettre-1-V2-blanc.png';

const TABS = [
  { id: 'vol', label: 'Vol', icon: PLANE_ICON, mount: mountVolPanel },
  { id: 'sons', label: 'Sons', icon: SOUND_ICON, mount: mountSoundsPanel },
  { id: 'annonces', label: 'Annonces', icon: MESSAGE_ICON, mount: mountAnnouncementsPanel },
];

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="app">
    <header class="app__header">
      <div class="app__brand">
        <img src="${logoUrl}" alt="Skyflyer Aviation" class="app__logo" />
      </div>
      <nav class="tabs" id="tabs">
        ${TABS.map(
          (t, i) => `
            <button class="tabs__item${i === 0 ? ' is-active' : ''}" data-tab="${t.id}" type="button">
              <span class="icon-badge">${t.icon}</span>
              ${t.label}
            </button>
          `,
        ).join('')}
      </nav>
    </header>
    ${TABS.map((t, i) => `<section class="panel" data-panel="${t.id}"${i === 0 ? '' : ' hidden'}></section>`).join('')}
  </main>
`;

const tabsEl = document.querySelector('#tabs');
const mounted = new Set();

function showTab(id) {
  document.querySelectorAll('.panel').forEach((el) => {
    el.hidden = el.dataset.panel !== id;
  });
  tabsEl.querySelectorAll('.tabs__item').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.tab === id);
  });

  if (!mounted.has(id)) {
    const tab = TABS.find((t) => t.id === id);
    tab.mount(document.querySelector(`.panel[data-panel="${id}"]`));
    mounted.add(id);
  }
}

tabsEl.addEventListener('click', (event) => {
  const btn = event.target.closest('.tabs__item');
  if (!btn) return;
  showTab(btn.dataset.tab);
});

showTab(TABS[0].id);

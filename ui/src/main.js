import './style.scss';
import { mountVolPanel } from './vol-panel.js';
import { mountSoundsPanel } from './sounds-panel.js';

const TABS = [
  { id: 'vol', label: '✈️ Vol', mount: mountVolPanel },
  { id: 'sons', label: '🔊 Sons', mount: mountSoundsPanel },
];

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="app">
    <header class="app__header">
      <div>
        <h1>Stream Inflight Command</h1>
        <p class="app__subtitle">Dashboard de gestion du stream</p>
      </div>
      <nav class="tabs" id="tabs">
        ${TABS.map(
          (t, i) => `<button class="tabs__item${i === 0 ? ' is-active' : ''}" data-tab="${t.id}" type="button">${t.label}</button>`,
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

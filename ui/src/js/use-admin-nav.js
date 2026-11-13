import { ref } from 'vue';

// Page affichée dans le dashboard, reflétée dans l'ancre de l'URL
// (index.html#sons) : un rechargement rouvre la même page, et les boutons
// Précédent/Suivant du navigateur fonctionnent.
const current = ref(readHash());

function readHash() {
  return decodeURIComponent(window.location.hash.slice(1));
}

window.addEventListener('hashchange', () => {
  current.value = readHash();
});

export function useAdminNav() {
  function go(key) {
    if (key === current.value) return;
    window.location.hash = key;
    current.value = key;
  }

  return { current, go };
}

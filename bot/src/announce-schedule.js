// État partagé entre index.js (planifie et envoie les annonces) et server.js
// (expose l'échéance + le message concerné au dashboard pour le compte à
// rebours affiché à côté du bon message dans la liste).
// nextAt reste `null` tant que le stream n'est pas en direct (voir
// live-status.js) : pas de compte à rebours affiché hors live, "Tester
// maintenant" continue de fonctionner à tout moment indépendamment de ça.
let nextAt = null;
let index = 0;
let live = false;

export function getNextAnnounceAt() {
  return nextAt;
}

export function setNextAnnounceAt(timestamp) {
  nextAt = timestamp;
}

export function getAnnounceIndex() {
  return index;
}

// Retourne l'index à utiliser pour cet envoi, puis avance la rotation.
export function consumeAnnounceIndex() {
  return index++;
}

export function getIsLive() {
  return live;
}

export function setIsLive(value) {
  live = value;
}

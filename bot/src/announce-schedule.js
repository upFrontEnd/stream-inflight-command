// État partagé entre index.js (planifie et envoie les annonces) et server.js
// (expose l'échéance + le message concerné au dashboard pour le compte à
// rebours affiché à côté du bon message dans la liste).
let nextAt = 0;
let index = 0;

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

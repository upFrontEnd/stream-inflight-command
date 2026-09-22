// État partagé entre index.js (planifie les envois) et server.js (expose
// l'échéance au dashboard pour le compte à rebours).
let nextAt = 0;

export function getNextAnnounceAt() {
  return nextAt;
}

export function setNextAnnounceAt(timestamp) {
  nextAt = timestamp;
}

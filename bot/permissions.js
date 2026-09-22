const ROLE_RANK = { viewer: 0, subscriber: 1, moderator: 2 };

export function getUserRole(userstate) {
  const isBroadcaster = userstate.badges?.broadcaster === '1';
  if (isBroadcaster || userstate.mod) return 'moderator';
  if (userstate.subscriber || userstate.badges?.subscriber) return 'subscriber';
  return 'viewer';
}

export function hasPermission(userstate, minRole) {
  return ROLE_RANK[getUserRole(userstate)] >= ROLE_RANK[minRole];
}

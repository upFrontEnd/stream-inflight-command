# stream-inflight-command

Commandes de chat Twitch (`!vol`, `!appareil`, `!plandevol`, `!meteo`) alimentées
automatiquement par le plan de vol SimBrief du jour, via un Cloudflare Worker,
plus un dashboard pour vérifier les données avant le live.

## Structure

```
stream-command/
├── package.json          dépendances (wrangler, vite, sass)
├── .nvmrc                 impose Node 22+ (requis par wrangler)
├── worker/
│   ├── wrangler.toml       config Cloudflare Worker
│   ├── .dev.vars.example   gabarit de variables locales
│   ├── index.js            router : une route par commande
│   ├── simbrief.js          appel + parsing de l'API SimBrief
│   ├── metar.js             appel + parsing de l'API METAR (aviationweather.gov)
│   └── commands.js           formatage du texte renvoyé par chaque commande
├── ui/
│   ├── vite.config.js        config Vite (root fixé sur ce dossier, port 5183)
│   ├── .env.example          gabarit de variables locales
│   ├── index.html
│   └── src/                  dashboard de preview (JS + SCSS)
└── bot/
    ├── .env.example           gabarit de variables locales
    ├── index.js                connexion Twitch + boucle de commandes
    ├── commands.js              config : commande → son + rôle minimum
    ├── permissions.js            viewer / subscriber / moderator
    ├── server.js                  serveur WebSocket + fichiers statiques (Bun natif)
    ├── overlay/                   page à ajouter comme Browser Source dans OBS
    └── sounds/                    fichiers audio (non commités)
```

Le Worker interroge SimBrief + aviationweather.gov et expose une route texte
par commande, à brancher dans StreamElements avec
`$(urlfetch https://ton-worker.workers.dev/vol)`.

Le bot (`bot/`) est un bot Twitch 100% custom, indépendant du Worker : il se
connecte au chat, et quand quelqu'un tape une commande son autorisée pour son
rôle, il pousse un événement en WebSocket vers un overlay affiché dans OBS,
qui joue le son.

## Prérequis : Node 22+

Wrangler exige Node 22+. Si Node 22 n'est pas encore installé :

```bash
nvm install 22
```

Tous les scripts (`bun run dev:worker`, `bun run build:ui`, etc.) passent par
`scripts/with-node22.sh`, qui bascule automatiquement sur Node 22 via nvm
avant de lancer la vraie commande — pas besoin de faire `nvm use` toi-même.

⚠️ Ne pas contourner ça en forçant `wrangler` à tourner sous le runtime de Bun
(ex: un `bunfig.toml` avec `[run] bun = true`) — testé, ça fait planter le
serveur local en silence : il accepte la connexion mais ne répond jamais à
aucune requête, même une route qui ne fait aucun appel externe. Un vrai
Node 22+ est la seule solution fiable trouvée.

## Installation

```bash
bun install
```

## Configurer SimBrief

```bash
cp worker/.dev.vars.example worker/.dev.vars
# éditer worker/.dev.vars et renseigner SIMBRIEF_USERNAME (ton userid SimBrief, ex: 57166)
```

`.dev.vars` n'est jamais commité (voir `.gitignore`). Le Worker détecte
automatiquement si c'est un `userid` numérique ou un `username` texte.

Tant qu'aucun plan de vol n'a été généré sur simbrief.com (bouton "Generate
Flight Plan"), les commandes renverront `Erreur : No flight plan on file for
the specified user` — c'est normal, pas un bug.

## Développement local

```bash
bun run dev
```

Lance le Worker (`http://localhost:8787`) et le dashboard (`http://localhost:5183`,
s'ouvre automatiquement) en parallèle dans un seul terminal, logs préfixés
`[worker]`/`[ui]`. Ctrl+C arrête les deux.

Besoin de les lancer séparément (ex: pour ne voir que les logs de l'un) :

```bash
bun run dev:worker   # http://localhost:8787
bun run dev:ui        # http://localhost:5183
```

Le dashboard (`ui/`) appelle `http://localhost:8787/api/preview` par défaut
(configurable via `ui/.env.local`, voir `ui/.env.example`) et affiche pour
chaque commande : le texte tel qu'il apparaîtrait dans le chat, un badge
OK/Erreur, et un panneau dépliable avec le JSON brut SimBrief — le point de
contrôle avant chaque live.

On peut aussi vérifier une route directement, sans le dashboard :
`http://localhost:8787/vol`.

## Bot Twitch custom (sons déclenchés par le chat)

### 1. Compte + token Twitch

Le plus simple : utilise ton propre compte Twitch comme bot (pas besoin d'un
compte séparé pour commencer). Génère un token OAuth pour `tmi.js` sur
[twitchapps.com/tmi](https://twitchapps.com/tmi/) (connecte-toi avec le compte
qui doit parler dans le chat) — il donne directement une valeur au format
`oauth:xxxxxxxx...`. Tu peux le révoquer à tout moment depuis
[twitch.tv/settings/connections](https://www.twitch.tv/settings/connections).

### 2. Configurer

```bash
cp bot/.env.example bot/.env
# éditer bot/.env : TWITCH_BOT_USERNAME, TWITCH_OAUTH_TOKEN, TWITCH_CHANNEL
```

`bot/.env` n'est jamais commité.

### 3. Ajouter des sons et des commandes

Dépose tes fichiers audio dans `bot/sounds/` (non commités, voir
`bot/sounds/README.md` — souvent protégés par droits d'auteur). Puis déclare
chaque commande dans `bot/commands.js` :

```js
export const soundCommands = {
  '!boom': { file: 'boom.mp3', minRole: 'viewer' },
  '!airhorn': { file: 'airhorn.mp3', minRole: 'subscriber' },
  '!alert': { file: 'alert.mp3', minRole: 'moderator' },
};
```

`minRole` accepte `viewer` (tout le monde), `subscriber` (subs + modos +
streamer) ou `moderator` (modos + streamer). Un viewer qui tape une commande
au-dessus de son rôle reçoit un message du bot lui expliquant qu'il n'a pas la
permission ; rien ne se joue.

### 4. Lancer le bot

```bash
bun run bot
```

Affiche `Overlay sons dispo sur http://localhost:4242` une fois connecté au
chat.

### 5. Ajouter l'overlay dans OBS

Dans OBS : **Sources → + → Browser Source** → URL `http://localhost:4242`,
coche "Contrôler l'audio via OBS" si tu veux le monitorer/mixer comme les
autres sources, largeur/hauteur peu importantes (rien n'est visible, juste
audio). Le fond est transparent.

Teste en tapant une des commandes dans ton propre chat (sur ta chaîne, en tant
que streamer tu passes toujours en `moderator`).

## Déploiement

```bash
./scripts/with-node22.sh bunx wrangler login
./scripts/with-node22.sh bunx wrangler secret put SIMBRIEF_USERNAME --config worker/wrangler.toml
bun run deploy:worker
```

## Routes exposées par le Worker

| Route           | Description                                  |
| ---------------- | --------------------------------------------- |
| `/vol`           | Départ, arrivée, route, distance              |
| `/appareil`      | Type d'appareil, immatriculation              |
| `/plandevol`     | Résumé : altitude de croisière, temps, carburant |
| `/meteo`         | METAR brut départ/arrivée (aviationweather.gov) |
| `/api/preview`   | JSON structuré : les 4 commandes + données brutes |

## À vérifier / limites connues

- Les champs SimBrief (`worker/simbrief.js`) ont été vérifiés contre un appel
  réel (`userid=57166`, sept. 2026) : `origin.icao_code`, `aircraft.icaocode`,
  `fuel.plan_ramp`, etc. sont corrects pour un plan de vol renseigné. Les
  champs qui n'apparaissent que dans certains types de plans (ex: `fuel.units`)
  restent à confirmer via le panneau "données brutes" du dashboard une fois
  un vrai plan généré.
- Le plan planifié (SimBrief) peut différer de l'appareil réellement chargé
  dans le sim à l'instant T ; lire l'état réel de MSFS nécessiterait SimConnect
  en local, hors scope ici.
- Pas de cache pour l'instant : chaque appel de commande refait un fetch vers
  SimBrief/METAR. Si besoin plus tard, Cache API ou Workers KV (gratuits dans
  des limites larges) permettront de limiter les appels.
- Plan gratuit Cloudflare Workers : 100 000 requêtes/jour, largement suffisant
  pour ce volume d'usage.

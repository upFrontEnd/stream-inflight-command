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
└── ui/
    ├── vite.config.js        config Vite (root fixé sur ce dossier, port 5183)
    ├── .env.example          gabarit de variables locales
    ├── index.html
    └── src/                  dashboard de preview (JS + SCSS)
```

Le Worker interroge SimBrief + aviationweather.gov et expose une route texte
par commande, à brancher dans StreamElements avec
`$(urlfetch https://ton-worker.workers.dev/vol)`.

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

Dans deux terminaux :

```bash
bun run dev:worker   # http://localhost:8787
bun run dev:ui        # http://localhost:5183, s'ouvre automatiquement
```

Le dashboard (`ui/`) appelle `http://localhost:8787/api/preview` par défaut
(configurable via `ui/.env.local`, voir `ui/.env.example`) et affiche pour
chaque commande : le texte tel qu'il apparaîtrait dans le chat, un badge
OK/Erreur, et un panneau dépliable avec le JSON brut SimBrief — le point de
contrôle avant chaque live.

On peut aussi vérifier une route directement, sans le dashboard :
`http://localhost:8787/vol`.

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

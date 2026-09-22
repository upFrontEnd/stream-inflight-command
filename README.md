# stream-inflight-command

Bot Twitch custom pour SkyflyerAviation : commandes de vol (`!appareil`,
`!plandevol`, `!meteo`) alimentées automatiquement par le plan de vol SimBrief
du jour, et commandes son par rôle (viewer/sub/modo), le tout dans un seul bot
connecté au chat — plus un dashboard pour vérifier les données et gérer les
sons avant le live.

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
│   └── src/                  dashboard (JS + SCSS)
│       ├── main.js             coquille + onglets (Vol / Sons)
│       ├── api.js               appels au Worker et au bot
│       ├── vol-panel.js          onglet Vol : preview des commandes SimBrief
│       ├── sounds-panel.js        onglet Sons : liste + ajout de sons
│       └── style.scss
└── bot/
    ├── .env.example           gabarit de variables locales
    ├── get-token.js            génère le token OAuth (Device Code Flow Twitch)
    ├── index.js                connexion Twitch + boucle de commandes
    ├── worker-commands.js       relaie !appareil/!plandevol/!meteo vers le Worker
    ├── load-commands.js         scanne bot/sounds/ pour construire les commandes son
    ├── commands-store.js         état partagé, rechargeable sans redémarrer le bot
    ├── permissions.js            viewer / subscriber / moderator
    ├── server.js                  WebSocket + fichiers statiques + API sons (Bun natif)
    ├── overlay/                   page à ajouter comme Browser Source dans OBS
    └── sounds/                    fichiers audio, un dossier par rôle (non commités)
        ├── all/                    accessible à tous
        ├── sub/                    subs + modos + streamer
        └── modo/                   modos + streamer
```

Le Worker interroge SimBrief + aviationweather.gov et expose une route texte
par commande (ex: `/plandevol`) — c'est une brique indépendante, testable
seule via curl/navigateur.

Le bot (`bot/`) est un bot Twitch 100% custom (`tmi.js`) qui gère tout côté
chat : il relaie `!appareil`/`!plandevol`/`!meteo` vers le Worker et poste la
réponse dans le chat, et quand quelqu'un tape une commande son autorisée pour
son rôle, il pousse un événement en WebSocket vers un overlay affiché dans
OBS, qui joue le son. Pas besoin de StreamElements ou d'un autre bot tiers —
tout passe par `bun run dev` / `bun run bot`.

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

Le dashboard a deux onglets :

- **Vol** — appelle `http://localhost:8787/api/preview` (Worker) et affiche
  pour chaque commande le texte tel qu'il apparaîtrait dans le chat, un badge
  OK/Erreur, et le JSON brut SimBrief. Le point de contrôle avant chaque live.
- **Sons** — appelle `http://localhost:4242/api/sounds` (bot, voir plus bas) :
  liste les sons par rôle et permet d'en ajouter un (glisser-déposer ou
  parcourir, nom de commande, rôle ALL/SUB/MODO) sans toucher au système de
  fichiers à la main. Nécessite `bun run bot` lancé en parallèle.

URLs configurables via `ui/.env.local` (voir `ui/.env.example`).

On peut aussi vérifier une route directement, sans le dashboard :
`http://localhost:8787/plandevol`.

## Bot Twitch custom

### 1. Créer une appli Twitch (une fois)

Le générateur historique twitchapps.com/tmi est mort. On utilise le flow
officiel de Twitch (Device Code Flow), zéro service tiers :

1. [dev.twitch.tv/console/apps/create](https://dev.twitch.tv/console/apps/create)
2. Name : ce que tu veux (ex: `stream-inflight-command-bot`)
3. OAuth Redirect URLs : `http://localhost` (placeholder, pas utilisé par ce flow)
4. Category : `Chat Bot`
5. Client Type : `Public`
6. Create → copie le **Client ID** généré

### 2. Configurer

```bash
cp bot/.env.example bot/.env
# éditer bot/.env : renseigner TWITCH_CLIENT_ID, TWITCH_BOT_USERNAME, TWITCH_CHANNEL
```

### 3. Générer le token OAuth

```bash
bun run bot:token
```

Ouvre la page affichée, connecte-toi avec le compte qui doit parler dans le
chat (ton propre compte marche très bien pour commencer), autorise
l'application. Le script affiche `TWITCH_OAUTH_TOKEN=oauth:...` à coller dans
`bot/.env`. Révocable à tout moment depuis
[twitch.tv/settings/connections](https://www.twitch.tv/settings/connections).

`bot/.env` n'est jamais commité (ni `TWITCH_CLIENT_ID`, ni le token).

### 4. Ajouter des sons et des commandes

**Depuis le dashboard** (le plus simple) : `bun run bot` + `bun run dev:ui`,
onglet **Sons** → glisse un fichier audio, donne un nom de commande, choisit
ALL/SUB/MODO, "Ajouter". Le fichier est déposé au bon endroit et le bot
recharge ses commandes immédiatement, sans redémarrage.

**À la main** : dépose un `.mp3`/`.wav`/`.ogg` directement dans un des trois
dossiers (non commités — souvent protégés par droits d'auteur), le nom du
fichier devient la commande :

```
bot/sounds/all/!boom.mp3         → !boom, utilisable par tous
bot/sounds/sub/!airhorn.mp3      → !airhorn, subs + modos + streamer
bot/sounds/modo/!alert.mp3       → !alert, modos + streamer
```

Dans les deux cas : pas besoin de toucher au code pour ajouter, retirer, ou
changer le rôle d'un son (déplace juste le fichier dans un autre dossier — le
bot les redétecte au prochain démarrage, ou immédiatement si ajouté via le
dashboard). Un viewer qui tape une commande au-dessus de son rôle reçoit un
message du bot lui expliquant qu'il n'a pas la permission ; rien ne se joue.

**Cooldown** : un seul son peut jouer toutes les 10 secondes, tous viewers et
toutes commandes confondus (évite le chaos audio en cas de spam). Les
commandes bloquées par le cooldown sont ignorées silencieusement, pas de
message dans le chat. Modérateurs et streamer y échappent toujours. Réglable
dans `bot/index.js` (`SOUND_COOLDOWN_MS`).

### 5. Lancer le bot

```bash
bun run bot
```

Affiche `Overlay sons dispo sur http://localhost:4242` une fois connecté au
chat.

### 6. Ajouter l'overlay dans OBS

Dans OBS : **Sources → + → Browser Source** → URL `http://localhost:4242`,
coche "Contrôler l'audio via OBS" si tu veux le monitorer/mixer comme les
autres sources, largeur/hauteur peu importantes (rien n'est visible, juste
audio). Le fond est transparent.

### 7. Commandes de vol (!appareil, !plandevol, !meteo)

Le bot relaie automatiquement ces trois commandes vers le Worker et poste sa
réponse dans le chat — aucune config supplémentaire si le Worker tourne en
local (`bun run dev:worker`, ou `bun run dev` qui lance tout ensemble) :
`bot/.env` pointe par défaut sur `WORKER_URL=http://localhost:8787`. Une fois
le Worker déployé sur Cloudflare, change cette valeur pour l'URL publique du
Worker afin que le bot fonctionne même quand ta machine ne tourne que le bot.

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
| `/appareil`      | Type d'appareil, immatriculation              |
| `/plandevol`     | Résumé (FL, durée, carburant) + route détaillée (départ/arrivée, route, distance) |
| `/meteo`         | METAR brut départ/arrivée (aviationweather.gov) |
| `/api/preview`   | JSON structuré : les 3 commandes + données brutes |

## Routes exposées par le bot (`http://localhost:4242`)

| Route                | Méthode | Description                                    |
| --------------------- | ------- | ----------------------------------------------- |
| `/`                    | GET     | Overlay à ajouter comme Browser Source dans OBS |
| `/ws`                  | —       | WebSocket, diffuse les événements "play"        |
| `/sounds/<catégorie>/<fichier>` | GET | Sert un fichier audio                    |
| `/api/sounds`          | GET     | Liste les sons par catégorie (all/sub/modo)     |
| `/api/sounds`          | POST    | Ajoute un son (`category`, `command`, `file` en `multipart/form-data`) |

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

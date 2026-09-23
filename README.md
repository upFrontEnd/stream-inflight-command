# stream-inflight-command

Bot Twitch custom : commandes de vol (`!vol`, `!appareil`,
`!plandevol`, `!meteo`, `!eta`) alimentées automatiquement par le plan de vol SimBrief
du jour. 

Commandes son par rôle (viewer/sub/modo), le tout dans un seul bot
connecté au chat Twitch, plus un dashboard pour vérifier les données avant le live.

## <img src="docs/banners/structure.png" alt="Structure" height="28" />

```
stream-command/
├── package.json                            Dépendances (wrangler, vite, sass)
├── .nvmrc                                  Impose Node 22+ (requis par wrangler)
├── worker/
│   ├── wrangler.toml                       Config Cloudflare Worker
│   ├── .dev.vars.example                   Gabarit de variables locales
│   ├── index.js                            Router : une route par commande
│   ├── simbrief.js                         Appel + parsing de l'API SimBrief
│   ├── metar.js                            Appel + parsing de l'API METAR (aviationweather.gov)
│   ├── vatsim.js                           Recherche un pilote sur le flux public VATSIM
│   ├── ivao.js                             Recherche un pilote sur le flux public IVAO (Whazzup)
│   ├── eta.js                              Calcule et formate l'ETA (!eta)
│   └── commands.js                         Formatage du texte renvoyé par chaque commande
├── ui/
│   ├── vite.config.js                      Config Vite (root fixé sur ce dossier, port 5183)
│   ├── .env.example                        Gabarit de variables locales
│   ├── index.html
│   └── src/                                Dashboard (JS + SCSS)
│       ├── img/
│       │   └── logo_Lettre-1-V2-blanc.png  Logo Skyflyer Aviation (fond sombre)
│       ├── js/
│       │   ├── main.js                     Onglets (Vol / Sons / Annonces)
│       │   ├── api.js                      Appels au Worker et au bot
│       │   ├── icons.js                    SVG des icônes d'onglets
│       │   ├── vol-panel.js                Onglet Vol : preview des commandes SimBrief
│       │   ├── sounds-panel.js             Onglet Sons : liste + ajout de sons
│       │   └── announcements-panel.js      Onglet Annonces : liste + ajout de messages
│       └── scss/
│           ├── style.scss                  Point d'entrée : @use des partiels ci-dessous
│           ├── _base.scss                  Variables CSS, reset, body
│           ├── _layout.scss                En-tête, logo, onglets, icônes
│           ├── _forms.scss                 Boutons, champs, dropzone (partagés)
│           ├── _vol.scss                   Cartes de commandes, panneau JSON brut
│           ├── _sounds.scss                Liste des sons, chips cliquables
│           └── _announcements.scss         Liste des messages d'annonce
└── bot/
    ├── .env.example                        Gabarit de variables locales
    ├── announcements.example.json          Gabarit (le vrai fichier n'est pas commité)
    ├── src/
    │   ├── get-token.js                    Génère le token OAuth (Device Code Flow Twitch)
    │   ├── index.js                        Connexion Twitch + boucle de commandes
    │   ├── worker-commands.js              Relaie !vol/!appareil/!plandevol/!meteo/!eta vers le Worker
    │   ├── load-commands.js                Scanne bot/sounds/ pour construire les commandes son
    │   ├── commands-store.js               État partagé, rechargeable sans redémarrer le bot
    │   ├── announcements-store.js          Lecture/écriture de bot/announcements.json
    │   ├── announce-schedule.js            Échéance du prochain envoi, partagée avec server.js
    │   ├── permissions.js                  Viewer / subscriber / moderator
    │   └── server.js                       WebSocket + fichiers statiques + API sons/annonces (Bun natif)
    ├── overlay/                            Page à ajouter comme Browser Source dans OBS
    └── sounds/                             Fichiers audio, un dossier par rôle (non commités)
        ├── all/                            Accessible à tous
        ├── sub/                            Subs + modos + streamer
        └── modo/                           Modos + streamer
```

Le Worker interroge SimBrief + aviationweather.gov et expose un texte
par commande (ex: `/plandevol`). C'est une brique indépendante, testable
seule via curl/navigateur.

Le bot (`bot/`) est un bot Twitch 100% custom (`tmi.js`) qui gère tout côté
chat : il relaie `!vol`/`!appareil`/`!plandevol`/`!meteo`/`!eta` vers le Worker et poste la
réponse dans le chat, et quand quelqu'un tape une commande son autorisée pour
son rôle, il pousse un événement en WebSocket vers un overlay affiché dans
OBS, qui joue le son. Pas besoin de StreamElements ou d'un autre bot tiers :
tout passe par `bun run dev` / `bun run bot`.

## <img src="docs/banners/prerequis.png" alt="Prérequis : Node 22+" height="28" />

Wrangler exige Node 22+. Si Node 22 n'est pas encore installé :

```bash
nvm install 22
```

Tous les scripts (`bun run dev:worker`, `bun run build:ui`, etc.) passent par
`scripts/with-node22.sh`, qui bascule automatiquement sur Node 22 via nvm
avant de lancer la vraie commande, pas besoin de faire `nvm use` toi-même.

⚠️ Ne pas contourner ça en forçant `wrangler` à tourner sous le runtime de Bun
(ex: un `bunfig.toml` avec `[run] bun = true`) : testé, ça fait planter le
serveur local en silence : il accepte la connexion mais ne répond jamais à
aucune requête, même une route qui ne fait aucun appel externe. Un vrai
Node 22+ est la seule solution fiable trouvée.

## <img src="docs/banners/installation.png" alt="Installation" height="28" />

```bash
bun install
```

## <img src="docs/banners/simbrief.png" alt="Configurer SimBrief" height="28" />

```bash
cp worker/.dev.vars.example worker/.dev.vars
# éditer worker/.dev.vars et renseigner SIMBRIEF_USERNAME (ton userid SimBrief, ex: 57166)
```

`.dev.vars` n'est jamais commité (voir `.gitignore`). Le Worker détecte
automatiquement si c'est un `userid` numérique ou un `username` texte.

Tant qu'aucun plan de vol n'a été généré sur simbrief.com (bouton "Generate
Flight Plan"), les commandes renverront `Erreur : No flight plan on file for
the specified user`, c'est normal, pas un bug.

Pour `!eta` (facultatif) : renseigne aussi `VATSIM_CID` et/ou `IVAO_VID` dans
`worker/.dev.vars` (ton identifiant numérique de compte, pas ton callsign,
visible sur my.vatsim.net / ton profil ivao.aero). Laisse le champ vide si tu
ne voles pas sur ce réseau, `!eta` ignorera simplement celui qui manque.

## <img src="docs/banners/dev.png" alt="Développement local" height="28" />

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

Le dashboard a trois onglets :

- **Vol** : appelle `http://localhost:8787/api/preview` (Worker) et affiche
  pour chaque commande le texte tel qu'il apparaîtrait dans le chat, un badge
  OK/Erreur, et le JSON brut SimBrief. Le point de contrôle avant chaque live.
- **Sons** : appelle `http://localhost:4242/api/sounds` (bot, voir plus bas),
  liste les sons par rôle et permet d'en ajouter un (glisser-déposer ou
  parcourir, nom de commande, rôle ALL/SUB/MODO) sans toucher au système de
  fichiers à la main. Nécessite `bun run bot` lancé en parallèle.
- **Annonces** : appelle `http://localhost:4242/api/announcements`, liste les
  messages qui tournent en boucle dans le chat (voir plus bas) et permet d'en
  ajouter/supprimer directement, sans toucher au code. Nécessite aussi
  `bun run bot`.

URLs configurables via `ui/.env.local` (voir `ui/.env.example`).

On peut aussi vérifier une route directement, sans le dashboard :
`http://localhost:8787/plandevol`.

## <img src="docs/banners/bot-twitch.png" alt="Bot Twitch custom" height="28" />

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
dossiers (non commités, souvent protégés par droits d'auteur), le nom du
fichier devient la commande :

```
bot/sounds/all/!boom.mp3         → !boom, utilisable par tous
bot/sounds/sub/!airhorn.mp3      → !airhorn, subs + modos + streamer
bot/sounds/modo/!alert.mp3       → !alert, modos + streamer
```

Dans les deux cas : pas besoin de toucher au code pour ajouter, retirer, ou
changer le rôle d'un son (déplace juste le fichier dans un autre dossier : le
bot les redétecte au prochain démarrage, ou immédiatement si ajouté via le
dashboard). Un viewer qui tape une commande au-dessus de son rôle reçoit un
message du bot lui expliquant qu'il n'a pas la permission ; rien ne se joue.

**Cooldown** : un seul son peut jouer toutes les 10 secondes, tous viewers et
toutes commandes confondus (évite le chaos audio en cas de spam). Les
commandes bloquées par le cooldown sont ignorées silencieusement, pas de
message dans le chat. Modérateurs et streamer y échappent toujours. Réglable
dans `bot/src/index.js` (`SOUND_COOLDOWN_MS`).

### 5. Lancer le bot

```bash
bun run bot
```

Affiche `Overlay sons dispo sur http://localhost:4242` une fois connecté au
chat.

`bun run bot` passe par `scripts/bot-watchdog.sh` : si le bot plante (token
Twitch expiré, coupure réseau...), il redémarre automatiquement avec un délai
croissant (5s, 10s, 20s... jusqu'à 60s max) plutôt que de rester éteint en
silence jusqu'à ce qu'on s'en rende compte en plein live. Un token expiré fera
quand même planter chaque tentative jusqu'à en régénérer un nouveau
(`bun run bot:token`), mais le bot repart tout seul dès que c'est fait, sans
redémarrage manuel. Pour lancer le bot une seule fois sans surveillance (utile
en debug) : `bun run bot:once`.

### 6. Ajouter l'overlay dans OBS

Dans OBS : **Sources → + → Browser Source** → URL `http://localhost:4242`,
coche "Contrôler l'audio via OBS" si tu veux le monitorer/mixer comme les
autres sources, largeur/hauteur peu importantes (rien n'est visible, juste
audio). Le fond est transparent.

### 7. Commandes de vol (!vol, !appareil, !plandevol, !meteo, !eta)

Le bot relaie automatiquement ces commandes vers le Worker et poste sa
réponse dans le chat, aucune config supplémentaire si le Worker tourne en
local (`bun run dev:worker`, ou `bun run dev` qui lance tout ensemble) :
`bot/.env` pointe par défaut sur `WORKER_URL=http://localhost:8787`. Une fois
le Worker déployé sur Cloudflare, change cette valeur pour l'URL publique du
Worker afin que le bot fonctionne même quand ta machine ne tourne que le bot.

`!eta` cherche ta session en direct, d'abord sur IVAO (distance restante
fournie par leur API, pas de calcul à faire), puis sur VATSIM (distance
calculée nous-mêmes entre ta position live et les coordonnées de destination
du plan SimBrief) si IVAO ne te trouve pas. Si tu n'es connecté sur aucun des
deux, le bot répond simplement que tu n'es pas en vol.

Teste en tapant une des commandes dans ton propre chat (sur ta chaîne, en tant
que streamer tu passes toujours en `moderator`).

### 8. Messages d'annonce automatiques

Le bot envoie un message dans le chat toutes les `ANNOUNCE_INTERVAL_MINUTES`
(30 par défaut, réglable dans `bot/.env`), en tournant dans la liste des
messages configurés (pas deux fois le même de suite tant qu'il y en a
plusieurs). Rien n'est envoyé si la liste est vide.

**Depuis le dashboard** : onglet **Annonces** → tape un message, "Ajouter".
Suppression en un clic sur le ✕. Pas de redémarrage du bot nécessaire, la
liste est relue à chaque envoi programmé.

Un compte à rebours affiche le temps avant le prochain envoi programmé, et le
bouton **"Tester maintenant"** envoie tout de suite le prochain message de la
rotation dans le vrai chat, sans décaler le minutage des envois suivants.
Pratique pour vérifier le rendu sans attendre 30 minutes.

Les messages sont stockés dans `bot/announcements.json` (non commité, voir
`bot/announcements.example.json` pour le format si tu préfères éditer à la
main).

## <img src="docs/banners/deploiement.png" alt="Déploiement" height="28" />

```bash
./scripts/with-node22.sh bunx wrangler login
./scripts/with-node22.sh bunx wrangler secret put SIMBRIEF_USERNAME --config worker/wrangler.toml
bun run deploy:worker
```

## <img src="docs/banners/routes-worker.png" alt="Routes exposées par le Worker" height="28" />

| Route           | Description                                  |
| ---------------- | --------------------------------------------- |
| `/vol`           | Résumé : FL, durée, carburant                 |
| `/appareil`      | Type d'appareil, immatriculation              |
| `/plandevol`     | Route détaillée : départ/arrivée, route, distance |
| `/meteo`         | METAR brut départ/arrivée (aviationweather.gov) |
| `/eta`           | ETA en direct via IVAO ou VATSIM (whazzup/data feed) |
| `/api/preview`   | JSON structuré : les 5 commandes + données brutes |

## <img src="docs/banners/routes-bot.png" alt="Routes exposées par le bot" height="28" /> (`http://localhost:4242`)

| Route                | Méthode | Description                                    |
| --------------------- | ------- | ----------------------------------------------- |
| `/`                    | GET     | Overlay à ajouter comme Browser Source dans OBS |
| `/ws`                  | N/A     | WebSocket, diffuse les événements "play"        |
| `/sounds/<catégorie>/<fichier>` | GET | Sert un fichier audio                    |
| `/api/sounds`          | GET     | Liste les sons par catégorie (all/sub/modo)     |
| `/api/sounds`          | POST    | Ajoute un son (`category`, `command`, `file` en `multipart/form-data`) |
| `/api/announcements`   | GET     | Liste les messages d'annonce                    |
| `/api/announcements`   | POST    | Ajoute un message (`{ "text": "..." }` en JSON) |
| `/api/announcements/<id>` | DELETE | Supprime un message                          |
| `/api/announcements/schedule` | GET | `{ nextAt }` : timestamp du prochain envoi programmé |
| `/api/announcements/test` | POST | Envoie tout de suite le prochain message, sans décaler le minutage |

## <img src="docs/banners/limites.png" alt="À vérifier / limites connues" height="28" />

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
- Le token OAuth Twitch (`bot/.env`) n'est pas rafraîchi automatiquement et
  finit par expirer (aucune logique de `refresh_token` implémentée). Le bot
  plante alors avec `Login authentication failed` ; `scripts/bot-watchdog.sh`
  continue de retenter en arrière-plan, mais il faut régénérer un nouveau
  token (`bun run bot:token`) pour que ça reparte.

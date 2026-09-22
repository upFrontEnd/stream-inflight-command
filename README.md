# stream-inflight-command

Commandes de chat Twitch (`!vol`, `!appareil`, `!plandevol`, `!meteo`) alimentées
automatiquement par le plan de vol SimBrief du jour, via un Cloudflare Worker.

## Structure

```
stream-command/
├── package.json          dépendances (wrangler)
├── bunfig.toml            force `bun run` à utiliser le runtime Bun
└── worker/
    ├── wrangler.toml       config Cloudflare Worker
    ├── .dev.vars.example   gabarit de variables locales
    ├── index.js            router : une route par commande
    ├── simbrief.js          appel + parsing de l'API SimBrief
    ├── metar.js             appel + parsing de l'API METAR (aviationweather.gov)
    └── commands.js           formatage du texte renvoyé par chaque commande
```

Le Worker interroge SimBrief + aviationweather.gov et expose une route texte
par commande, à brancher dans StreamElements avec
`$(urlfetch https://ton-worker.workers.dev/vol)`.

## Installation

```bash
bun install
```

## Configurer SimBrief

```bash
cp worker/.dev.vars.example worker/.dev.vars
# éditer worker/.dev.vars et renseigner SIMBRIEF_USERNAME
```

`.dev.vars` n'est jamais commité (voir `.gitignore`).

## Développement local

```bash
bun run dev:worker   # http://localhost:8787
```

Pour vérifier qu'une commande renvoie les bonnes données avant le live, ouvre
directement la route dans le navigateur ou via curl, par ex.
`http://localhost:8787/vol`. `http://localhost:8787/api/preview` renvoie les
4 commandes + le JSON brut SimBrief en une fois.

> `bunfig.toml` force `bun run` à utiliser le runtime de Bun plutôt que Node
> pour exécuter les scripts. Wrangler exige Node 20+/22+ ; ce réglage
> contourne le problème si ta machine a une version de Node plus ancienne
> installée globalement.

## Déploiement

```bash
bunx wrangler login
bunx wrangler secret put SIMBRIEF_USERNAME --config worker/wrangler.toml
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

- Les noms de champs SimBrief (`origin.icao_code`, `aircraft.icaocode`,
  `fuel.plan_ramp`, etc., dans `worker/simbrief.js`) ont été recoupés à
  partir d'intégrations tierces open-source, pas d'un appel réel — vérifie
  `/api/preview` dès le premier test avec un vrai plan de vol et ajuste si un
  champ ne correspond pas.
- Le plan planifié (SimBrief) peut différer de l'appareil réellement chargé
  dans le sim à l'instant T ; lire l'état réel de MSFS nécessiterait SimConnect
  en local, hors scope ici.
- Pas de cache pour l'instant : chaque appel de commande refait un fetch vers
  SimBrief/METAR. Si besoin plus tard, Cache API ou Workers KV (gratuits dans
  des limites larges) permettront de limiter les appels.
- Plan gratuit Cloudflare Workers : 100 000 requêtes/jour, largement suffisant
  pour ce volume d'usage.

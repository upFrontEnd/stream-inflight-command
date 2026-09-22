# stream-inflight-command

Commandes de chat Twitch (`!vol`, `!appareil`, `!plandevol`, `!meteo`) alimentées
automatiquement par le plan de vol SimBrief du jour, via un Cloudflare Worker.

## Structure

- `worker/` — le Cloudflare Worker qui interroge SimBrief + aviationweather.gov (METAR)
  et expose une route texte par commande, à brancher dans StreamElements avec
  `$(urlfetch https://ton-worker.workers.dev/vol)`.
- `ui/` — dashboard de preview (Vite + Bun, TypeScript vanilla, SCSS) pour vérifier
  avant le live que chaque commande renvoie bien les bonnes données.

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

Dans deux terminaux :

```bash
bun run dev:worker   # http://localhost:8787
bun run dev:ui        # http://localhost:5173
```

L'UI appelle `http://localhost:8787/api/preview` par défaut (configurable via
`ui/.env.local`, voir `ui/.env.example`). Elle affiche pour chaque commande le
texte tel qu'il apparaîtrait dans le chat, un statut OK/Erreur, et un panneau
dépliable avec le JSON brut renvoyé par SimBrief — c'est le point de contrôle
avant chaque live.

## Déploiement du Worker

```bash
bunx wrangler login
bunx wrangler secret put SIMBRIEF_USERNAME   # dans worker/
bun --cwd worker run deploy
```

## Routes exposées par le Worker

| Route           | Description                                  |
| ---------------- | --------------------------------------------- |
| `/vol`           | Départ, arrivée, route, distance              |
| `/appareil`      | Type d'appareil, immatriculation              |
| `/plandevol`     | Résumé : altitude de croisière, temps, carburant |
| `/meteo`         | METAR brut départ/arrivée (aviationweather.gov) |
| `/api/preview`   | JSON structuré pour l'UI de preview           |

## À vérifier / limites connues

- Les noms de champs SimBrief (`origin.icao_code`, `aircraft.icaocode`,
  `fuel.plan_ramp`, etc., dans `worker/src/simbrief.ts`) ont été recoupés à
  partir d'intégrations tierces open-source, pas d'un appel réel — utilise le
  panneau "données brutes" de l'UI pour confirmer/ajuster dès le premier test
  avec un vrai plan de vol.
- Le plan planifié (SimBrief) peut différer de l'appareil réellement chargé
  dans le sim à l'instant T ; lire l'état réel de MSFS nécessiterait SimConnect
  en local, hors scope ici.
- Pas de cache pour l'instant : chaque appel de commande refait un fetch vers
  SimBrief/METAR. Si besoin plus tard, Cache API ou Workers KV (gratuits dans
  des limites larges) permettront de limiter les appels.
- Plan gratuit Cloudflare Workers : 100 000 requêtes/jour, largement suffisant
  pour ce volume d'usage.

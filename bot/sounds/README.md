# bot/sounds/

Dépose ici tes fichiers audio (`.mp3`, `.wav`, `.ogg`). Le nom du fichier
devient la commande de chat, le dossier détermine qui peut l'utiliser :

- `all/` — utilisable par tous les viewers
- `sub/` — subs + modérateurs + streamer
- `modo/` — modérateurs + streamer uniquement

Exemple : `bot/sounds/all/!boom.mp3` devient la commande `!boom`, jouable par
n'importe qui dans le chat.

Ce dossier n'est pas commité (voir `.gitignore`) : les sons sont souvent des
extraits protégés par droits d'auteur, et ce repo est public.

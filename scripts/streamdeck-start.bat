@echo off
REM Fait pour etre lance par un bouton Stream Deck (action "Systeme > Ouvrir"
REM pointee sur ce fichier) : ouvre une fenetre et demarre Worker + UI + bot
REM ensemble. Laisse la fenetre ouverte pour voir les logs / faire Ctrl+C.
cd /d "%~dp0.."
call bun run dev
pause

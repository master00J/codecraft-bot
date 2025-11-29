# Egg Startup Command Fix

## Probleem
De startup command draait `node index.js` voordat dependencies zijn geïnstalleerd, waardoor `discord.js` niet gevonden kan worden. Ook moeten files automatisch van GitHub gepulled worden bij elke start.

## Oplossing
Update de Startup Command in je Pterodactyl Egg configuratie:

### Stap 1: Ga naar Egg configuratie
1. Pterodactyl Panel → Nests → Discord Bots → Discord Bot (Node.js)
2. Klik op "Configuration" tab
3. Scroll naar "Startup Command"

### Stap 2: Update Startup Command
Verander van:
```
git pull origin main 2>/dev/null || true && npm install --production && node index.js
```

Naar (gebruik start.sh script - beste optie):
```bash
bash start.sh
```

Dit script:
- Pullt automatisch de laatste code van GitHub
- Installeert dependencies als ze ontbreken
- Start de bot

OF (alternatief zonder start.sh):
```bash
cd /home/container && if [ -d .git ]; then git pull origin main 2>/dev/null || true; fi && if [ -f package.json ] && ([ ! -d node_modules ] || [ ! -f node_modules/.package-lock.json ]); then npm install --production; fi && node index.js
```

### Stap 3: Sla op
Klik op "Save" om de configuratie op te slaan.

## Alternatief: Gebruik start.sh script
Als je `start.sh` script gebruikt (aangemaakt door deployment), gebruik dan deze startup command:
```bash
bash start.sh
```

Dit script controleert automatisch of dependencies geïnstalleerd zijn en installeert ze indien nodig.


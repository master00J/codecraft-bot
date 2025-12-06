# Hoe start.sh Updaten op Pterodactyl Server

## Waar moet je het script uitvoeren?

Het script moet worden uitgevoerd in de **Pterodactyl Server Console**.

## Stap-voor-stap instructies:

### Stap 1: Ga naar Pterodactyl Panel
1. Log in op je Pterodactyl panel
2. Ga naar je server (de Discord bot server)
3. Klik op de server om de details te zien

### Stap 2: Open de Console
1. Klik op de **"Console"** tab (of **"Terminal"** tab)
2. Dit opent een terminal/console waar je commando's kunt uitvoeren

### Stap 3: Stop de server (optioneel maar aanbevolen)
Voer dit commando uit om de server te stoppen:
```bash
stop
```
Of klik op de "Stop" knop in het Pterodactyl panel.

### Stap 4: Voer het update script uit
Kopieer en plak het **hele** onderstaande script in de console en druk op Enter:

```bash
cat > start.sh << 'EOF'
#!/bin/bash
# Auto-deploy bot files from GitHub and start bot
cd /home/container

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Improved git pull with conflict resolution
if [ -d .git ]; then
    echo "📥 Pulling latest code from GitHub..."
    
    # Configure git to avoid merge conflicts
    git config pull.rebase false 2>/dev/null || true
    git config pull.ff only 2>/dev/null || true
    
    # Fetch latest changes first
    git fetch origin main 2>&1 || {
        echo "⚠️  Git fetch failed, checking remote configuration..."
        git remote set-url origin https://github.com/master00J/codecraft-bot.git 2>/dev/null || true
        git fetch origin main 2>&1 || echo "⚠️  Still failed to fetch"
    }
    
    # Check if there are local changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        echo "⚠️  Local changes detected, resetting them..."
        git reset --hard HEAD 2>/dev/null || true
    fi
    
    # Try to pull with different strategies
    if ! git pull origin main 2>&1; then
        echo "⚠️  Standard pull failed, trying reset strategy..."
        
        # Reset to remote state (discard local changes)
        git fetch origin main 2>&1
        git reset --hard origin/main 2>&1 || {
            echo "⚠️  Reset failed, trying checkout..."
            git checkout -f main 2>/dev/null || true
            git reset --hard origin/main 2>&1 || true
        }
        
        echo "✅ Code reset to latest version from GitHub"
    else
        echo "✅ Successfully pulled latest code"
    fi
    
    # Clean up any untracked files that might cause issues
    git clean -fd 2>/dev/null || true
fi

# Clone repository if index.js doesn't exist
if [ ! -f index.js ]; then
    echo "📦 Cloning bot files from GitHub..."
    git clone --depth 1 --branch main https://github.com/master00J/codecraft-bot.git /tmp/bot-files 2>/dev/null || true
    
    if [ -d /tmp/bot-files ]; then
        # Copy bot files (index.js for auto-start)
        cp -r /tmp/bot-files/index.js ./index.js 2>/dev/null || true
        cp -r /tmp/bot-files/modules . 2>/dev/null || true
        cp -r /tmp/bot-files/package*.json . 2>/dev/null || true
        cp -r /tmp/bot-files/*.json . 2>/dev/null || true
        
        # Initialize git repository for future pulls
        git init 2>/dev/null || true
        git remote add origin https://github.com/master00J/codecraft-bot.git 2>/dev/null || git remote set-url origin https://github.com/master00J/codecraft-bot.git 2>/dev/null || true
        
        # Cleanup
        rm -rf /tmp/bot-files
        echo "✅ Bot files deployed"
    fi
fi

# Always check and install dependencies if package.json exists
if [ -f package.json ]; then
    if [ ! -d node_modules ] || [ ! -f node_modules/.package-lock.json ]; then
        echo "📦 Installing dependencies from package.json..."
        npm install --production 2>&1 || {
            echo "⚠️  npm install failed, trying with --legacy-peer-deps..."
            npm install --production --legacy-peer-deps 2>&1 || echo "⚠️  Some packages may have failed to install"
        }
        echo "✅ Dependencies installed"
    else
        echo "✅ Dependencies already installed"
    fi
fi

# Start bot
echo "🚀 Starting bot..."
exec node index.js
EOF

chmod +x start.sh
echo "✅ start.sh updated successfully!"
```

### Stap 5: Verifieer dat het werkt
Controleer of het bestand is aangemaakt:
```bash
ls -la start.sh
```

Je zou moeten zien dat `start.sh` bestaat en executable is (heeft een `x` in de permissions).

### Stap 6: Start de server opnieuw
1. Klik op de **"Start"** knop in het Pterodactyl panel
2. Of voer `start` uit in de console
3. Kijk naar de console output - je zou moeten zien:
   ```
   📥 Pulling latest code from GitHub...
   ✅ Successfully pulled latest code
   ```
   Of als er conflicten waren:
   ```
   ⚠️  Standard pull failed, trying reset strategy...
   ✅ Code reset to latest version from GitHub
   ```

## Alternatief: Snelle Fix (Alleen git reset)

Als je alleen de huidige git pull error wilt oplossen zonder het hele script te updaten:

```bash
cd /home/container
git fetch origin main
git reset --hard origin/main
git clean -fd
```

Dan de server opnieuw starten.

## Belangrijk:

- ✅ Voer het script uit in de **Pterodactyl Console/Terminal** (niet in je lokale terminal)
- ✅ Kopieer het **hele** script inclusief de `cat > start.sh << 'EOF'` en `EOF` regels
- ✅ Het script wordt opgeslagen in `/home/container/start.sh` op de server
- ✅ Na het updaten moet je de server opnieuw starten om het nieuwe script te gebruiken

## Screenshot locatie (ter referentie):

```
Pterodactyl Panel
  └─ Servers
      └─ [Jouw Server]
          └─ Console Tab  ← Hier voer je het script uit
```



# Update Egg Install Script in Pterodactyl

## Waar moet je het script zetten?

In de **Pterodactyl Panel → Nests → Discord Bots → Discord Bot (Node.js) → Install Script** tab.

## Stap-voor-stap instructies:

### Stap 1: Ga naar Egg Configuratie
1. Log in op je Pterodactyl panel
2. Ga naar **Nests** → **Discord Bots** → **Discord Bot (Node.js)**
3. Klik op **"Configuration"** tab
4. Klik op **"Install Script"** tab (zoals in je screenshot)

### Stap 2: Vervang het hele script
Kopieer het **hele** onderstaande script en plak het in de Install Script editor:

```bash
cd /mnt/server

echo "📦 Cloning ComCraft bot from GitHub..."
git clone --depth 1 https://github.com/master00J/codecraft-bot.git .

echo "🛠️ Installing npm dependencies..."
npm install --production

echo "📝 Creating start.sh script..."
cat > start.sh << 'EOF'
#!/bin/bash
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
    git clone --depth 1 --branch main https://github.com/master00J/codecraft-bot.git /tmp/bot-clone 2>&1 || {
        echo "⚠️  Failed to clone repository"
        exit 1
    }
    
    if [ -d /tmp/bot-clone ]; then
        cp /tmp/bot-clone/index.js ./ 2>/dev/null || true
        cp /tmp/bot-clone/package.json ./ 2>/dev/null || true
        cp -r /tmp/bot-clone/modules ./ 2>/dev/null || true
        rm -rf /tmp/bot-clone
        echo "✅ Bot files downloaded"
    fi
fi

# Always check and install dependencies if package.json exists
if [ -f package.json ]; then
    if [ ! -d node_modules ] || [ ! -f node_modules/.package-lock.json ]; then
        echo "📦 Installing dependencies (this may take a few minutes)..."
        npm install --production --loglevel=error || {
            echo "⚠️  npm install failed, trying with --legacy-peer-deps..."
            npm install --production --legacy-peer-deps --loglevel=error || {
                echo "❌ Failed to install dependencies"
                exit 1
            }
        }
        echo "✅ Dependencies installed"
    else
        echo "✅ Dependencies already installed"
    fi
else
    echo "⚠️  package.json not found - dependencies cannot be installed"
fi

# Start bot
echo "🚀 Starting bot..."
exec node index.js
EOF

chmod +x start.sh
echo "✅ Bot installed successfully with improved start.sh script!"
```

### Stap 3: Sla op
1. Klik op **"Save"** of **"Update"** knop onderaan
2. Het script is nu opgeslagen in de Egg configuratie

### Stap 4: Toepassen op bestaande servers
Voor **bestaande servers** die al draaien, moet je de `start.sh` handmatig updaten via de server console, OF:

**Optie A: Reinstall server** (verliest data, niet aanbevolen)
- Stop de server
- Klik op "Reinstall" 
- Het nieuwe install script wordt uitgevoerd

**Optie B: Update start.sh via console** (aanbevolen)
- Ga naar de server → Console tab
- Voer dit uit:
```bash
cd /home/container && git fetch origin main && git reset --hard origin/main && git clean -fd
```
- Dan update start.sh met het nieuwe script (zie HOW_TO_UPDATE_START_SH.md)

**Optie C: Nieuwe servers**
- Alle **nieuwe servers** die je aanmaakt gebruiken automatisch het verbeterde script

## Wat doet dit script?

1. **Bij installatie** (wanneer server wordt aangemaakt):
   - Clone de bot van GitHub
   - Installeer dependencies
   - Maak `start.sh` aan met het verbeterde git pull script

2. **Bij elke start** (via start.sh):
   - Gebruikt het verbeterde git pull script dat automatisch conflicten oplost
   - Reset naar remote state als pull faalt
   - Installeert dependencies als ze ontbreken
   - Start de bot

## Belangrijk:

- ✅ Dit script wordt gebruikt voor **alle nieuwe servers** die je aanmaakt
- ✅ Bestaande servers moeten handmatig worden geüpdatet (zie Optie B hierboven)
- ✅ Het script gooit lokale wijzigingen weg als er conflicten zijn (normaal voor deployment)



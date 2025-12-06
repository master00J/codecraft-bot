# Fix Git Pull op Bestaande Servers

Als je server nog steeds de oude `start.sh` gebruikt en git pull faalt, volg deze stappen:

## Oplossing 1: Update start.sh via Pterodactyl Console

Voer dit commando uit in de Pterodactyl server console:

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

## Oplossing 2: Direct Git Reset (Snelle Fix)

Als je alleen de lokale wijzigingen wilt weggooien en de laatste versie wilt ophalen:

```bash
cd /home/container
git fetch origin main
git reset --hard origin/main
git clean -fd
```

Daarna de server opnieuw starten.

## Oplossing 3: Via Dashboard (Toekomstig)

Er wordt gewerkt aan een functie in het dashboard om bestaande servers automatisch te updaten. Dit zal beschikbaar zijn in een toekomstige update.

## Verificatie

Na het updaten van `start.sh`, start de server opnieuw. Je zou moeten zien:

```
📥 Pulling latest code from GitHub...
✅ Successfully pulled latest code
```

Of als er conflicten waren:

```
⚠️  Standard pull failed, trying reset strategy...
✅ Code reset to latest version from GitHub
```

## Belangrijk

- Het verbeterde script gooit **lokale wijzigingen weg** als er conflicten zijn
- Dit is normaal voor een deployment server waar je altijd de laatste versie van GitHub wilt hebben
- Je eigen configuratie (zoals `.env` bestanden) worden niet aangepast


# Verbeterd Git Pull Script voor Pterodactyl

## Probleem
Git pull faalt telkens op de Pterodactyl server door lokale wijzigingen, merge conflicts, of remote configuratie problemen.

## Oplossing
Gebruik dit verbeterde git pull script dat automatisch problemen oplost:

### Update Startup Command in Pterodactyl Egg

Verander de startup command naar:

```bash
bash start.sh
```

### Update start.sh Script

Vervang de git pull sectie in `start.sh` met dit verbeterde script:

```bash
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
        echo "⚠️  Local changes detected, stashing them..."
        git stash push -m "Auto-stash before pull $(date +%Y%m%d_%H%M%S)" 2>&1 || {
            echo "⚠️  Stash failed, resetting local changes..."
            git reset --hard HEAD 2>&1 || true
        }
    fi
    
    # Try to pull with different strategies
    if ! git pull origin main 2>&1; then
        echo "⚠️  Standard pull failed, trying reset strategy..."
        
        # Get current branch
        CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
        
        # Reset to remote state (discard local changes)
        git fetch origin main 2>&1
        git reset --hard origin/main 2>&1 || {
            echo "⚠️  Reset failed, trying checkout..."
            git checkout -f main 2>&1 || true
            git reset --hard origin/main 2>&1 || true
        }
        
        echo "✅ Code reset to latest version from GitHub"
    else
        echo "✅ Successfully pulled latest code"
    fi
    
    # Clean up any untracked files that might cause issues
    git clean -fd 2>/dev/null || true
else
    echo "ℹ️  No git repository found, initializing..."
    git init 2>/dev/null || true
    git remote add origin https://github.com/master00J/codecraft-bot.git 2>/dev/null || git remote set-url origin https://github.com/master00J/codecraft-bot.git 2>/dev/null || true
    git fetch origin main 2>/dev/null || true
    git checkout -b main 2>/dev/null || true
    git branch --set-upstream-to=origin/main main 2>/dev/null || true
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
```

## Alternatief: Standalone Git Pull Script

Als je alleen git pull wilt verbeteren zonder het hele start.sh script te wijzigen, maak dan een apart script:

### Maak `git-pull-safe.sh`:

```bash
#!/bin/bash
# Safe git pull script that handles conflicts and errors

cd /home/container

if [ ! -d .git ]; then
    echo "ℹ️  No git repository found"
    exit 0
fi

echo "📥 Pulling latest code from GitHub..."

# Configure git
git config pull.rebase false 2>/dev/null || true

# Fetch first
git fetch origin main 2>&1 || {
    echo "⚠️  Fetch failed, resetting remote..."
    git remote set-url origin https://github.com/master00J/codecraft-bot.git 2>/dev/null || true
    git fetch origin main 2>&1 || {
        echo "❌ Failed to fetch from GitHub"
        exit 1
    }
}

# Check for local changes
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "⚠️  Local changes detected, resetting..."
    git reset --hard HEAD 2>/dev/null || true
fi

# Pull or reset
if git pull origin main 2>&1; then
    echo "✅ Successfully pulled latest code"
else
    echo "⚠️  Pull failed, resetting to remote state..."
    git reset --hard origin/main 2>&1 || {
        echo "❌ Failed to reset to remote state"
        exit 1
    }
    echo "✅ Reset to latest version"
fi

# Clean untracked files
git clean -fd 2>/dev/null || true

exit 0
```

Gebruik dit script in je startup command:
```bash
bash git-pull-safe.sh && npm install --production && node index.js
```

## Wat dit script doet:

1. **Configureert git** om merge conflicts te voorkomen
2. **Fetch eerst** om te zien of er updates zijn
3. **Detecteert lokale wijzigingen** en reset ze automatisch
4. **Probeert pull** met normale methode
5. **Valt terug op reset** als pull faalt (gooit lokale wijzigingen weg)
6. **Ruimt op** met git clean
7. **Configureert remote** als die niet bestaat

## Belangrijk:

Dit script **gooit lokale wijzigingen weg** als er conflicten zijn. Dit is normaal voor een deployment server waar je altijd de laatste versie van GitHub wilt hebben.


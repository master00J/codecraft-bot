# Verbeterd Install Script voor Pterodactyl Egg

Voeg dit toe aan het **Install Script** tab in je Pterodactyl Egg configuratie:

```bash
#!/bin/bash
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

# Pull latest code from GitHub if repository exists
if [ -d .git ]; then
    echo "📥 Pulling latest code from GitHub..."
    git pull origin main 2>&1 || echo "⚠️  Git pull failed (continuing with existing files)"
elif [ -f index.js ]; then
    echo "ℹ️  No git repository found, initializing for future pulls..."
    git init 2>/dev/null || true
    git remote add origin https://github.com/master00J/codecraft-bot.git 2>/dev/null || git remote set-url origin https://github.com/master00J/codecraft-bot.git 2>/dev/null || true
    git fetch origin main 2>/dev/null || true
fi

# Download files if index.js doesn't exist
if [ ! -f index.js ]; then
    echo "📥 Downloading bot files from GitHub..."
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
echo "✅ Bot installed successfully with start.sh script!"


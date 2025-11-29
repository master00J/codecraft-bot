# ComCraft Discord Bot

A feature-rich Discord bot for community management, economy, leveling, and more.

## Features

- 🎮 **Leveling System** - XP and ranks with custom rank cards
- 💰 **Economy** - Virtual currency, daily rewards, gambling
- 🎰 **Casino** - Coinflip, duels, and more
- 🎂 **Birthdays** - Birthday tracking and announcements
- 🎁 **Giveaways** - Create and manage giveaways
- 🎫 **Tickets** - Support ticket system
- 🛡️ **Moderation** - Warn, mute, kick, ban
- 🎵 **Music** - Music playback (requires additional setup)
- 📢 **Announcements** - Scheduled messages and updates
- 🎮 **Game News** - Automatic game news updates
- 📺 **Streaming** - Twitch/YouTube live notifications
- 🤖 **AI Assistant** - AI-powered chat assistant

## Installation

1. Clone the repository:
```bash
git clone https://github.com/master00J/codecraft-bot.git
cd codecraft-bot
```

2. Install dependencies:
```bash
npm install --production
```

3. Copy `env.example` to `.env` and fill in your values:
```bash
cp env.example .env
```

4. Start the bot:
```bash
node index.js
```

## Environment Variables

See `env.example` for all available configuration options.

### Required:
- `DISCORD_BOT_TOKEN` - Your Discord bot token
- `DISCORD_CLIENT_ID` - Your Discord application client ID
- `GUILD_ID` - Your Discord server ID
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

## Pterodactyl Deployment

This bot is designed to work with Pterodactyl Panel for automated deployment.

### Install Script:
```bash
#!/bin/bash
cd /mnt/server
git clone --depth 1 https://github.com/master00J/codecraft-bot.git .
npm install --production
echo "✅ Bot installed!"
```

### Startup Command:
```
node index.js
```

## License

Proprietary - ComCraft Solutions



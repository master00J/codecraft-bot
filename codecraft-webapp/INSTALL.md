# 🚀 CodeCraft WebApp - Installatie Handleiding

Complete gids om de webapp op te zetten en te integreren met je Discord bot.

## 📋 Vereisten

- Node.js 18+ geïnstalleerd ([download hier](https://nodejs.org/))
- Een Supabase account ([aanmelden](https://supabase.com))
- Discord applicatie (je bestaande bot app)
- Git

## 🔧 Stap 1: Project Setup

### 1.1 Installeer Dependencies

```bash
cd codecraft-webapp
npm install
```

### 1.2 Test of alles werkt

```bash
npm run dev
```

Bezoek http://localhost:3000 - je zou de homepage moeten zien!

## 🗄️ Stap 2: Supabase Database Setup

### 2.1 Maak Supabase Project

1. Ga naar [supabase.com](https://supabase.com)
2. Klik "New Project"
3. Kies een naam: `codecraft-solutions`
4. Kies een wachtwoord (bewaar dit!)
5. Selecteer regio: `West EU (Ireland)` voor Nederland/België
6. Klik "Create Project" en wacht ~2 minuten

### 2.2 Haal API Credentials

1. Ga naar Settings (⚙️) > API
2. Kopieer:
   - `Project URL` → Dit is je `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → Dit is je `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → Dit is je `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **Geheim!**

### 2.3 Run Database Schema

1. Ga naar SQL Editor in Supabase
2. Klik "New Query"
3. Plak de hele SQL schema uit `README.md` (Users, Orders, Tickets, etc.)
4. Klik "Run" (of F5)
5. Je zou "Success" moeten zien

## 🔐 Stap 3: Discord OAuth Setup

### 3.1 Discord Developer Portal

1. Ga naar [Discord Developer Portal](https://discord.com/developers/applications)
2. Selecteer je BOT applicatie
3. Ga naar "OAuth2" > "General"

### 3.2 Add Redirect URLs

Voeg deze URLs toe aan "Redirects":
```
http://localhost:3000/api/auth/callback
https://jouw-domain.com/api/auth/callback (later voor productie)
```

### 3.3 Get Credentials

- Client ID: al zichtbaar (kopieer deze)
- Client Secret: klik "Reset Secret" → kopieer deze ⚠️ **Geheim!**

## ⚙️ Stap 4: Environment Variables

### 4.1 Maak .env.local bestand

In de `codecraft-webapp` folder:

```bash
cp .env.example .env.local
```

### 4.2 Vul de variabelen in

Open `.env.local` en vul IN:

```env
# Supabase (van stap 2.2)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Discord OAuth (van stap 3)
DISCORD_CLIENT_ID=1234567890123456789
DISCORD_CLIENT_SECRET=jouw_client_secret_hier

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Discord Bot (van je bestaande bot)
DISCORD_BOT_TOKEN=jouw_bot_token_hier
DISCORD_GUILD_ID=jouw_server_id_hier
```

## 🤖 Stap 5: Discord Bot Integratie

### 5.1 Installeer Supabase in Bot Project

In je Discord bot folder:

```bash
npm install @supabase/supabase-js
```

### 5.2 Maak Supabase Client

Maak `modules/supabase.js`:

```javascript
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

module.exports = { supabase }
```

### 5.3 Update je .env file (Discord bot)

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5.4 Sync Orders naar Supabase

In `index.js`, update je order creation:

```javascript
const { supabase } = require('./modules/supabase')

// Na order database insert:
await supabase.from('orders').insert({
  order_number: orderNumber,
  user_id: userIdFromSupabase, // moet je eerst opzoeken
  discord_channel_id: orderChannel.id,
  service_type: service,
  service_details: orderDetails,
  status: 'pending',
  payment_status: 'pending'
})
```

## ✅ Stap 6: Test de Integratie

### 6.1 Start de Webapp

```bash
cd codecraft-webapp
npm run dev
```

### 6.2 Test Discord Login

1. Ga naar http://localhost:3000
2. Klik "Login with Discord"
3. Authorize de app
4. Je wordt redirect naar Dashboard
5. Check Supabase → Table Editor → users (je user zou er moeten staan!)

### 6.3 Test Order Sync

1. In Discord, doe `/order service:discord_bot`
2. Vul het formulier in
3. Check Supabase → Table Editor → orders
4. Check webapp dashboard → Orders tab
5. Je order zou op beide plekken moeten staan!

## 🌐 Stap 7: Deploy naar Productie

### 7.1 Vercel (Aanbevolen)

```bash
# Installeer Vercel CLI
npm i -g vercel

# Deploy
cd codecraft-webapp
vercel

# Follow de prompts
```

### 7.2 Add Environment Variables in Vercel

1. Ga naar Vercel Dashboard → je project
2. Settings → Environment Variables
3. Voeg ALLE variabelen van `.env.local` toe
4. Update `NEXT_PUBLIC_APP_URL` naar je echte domain

### 7.3 Update Discord Redirect URL

Voeg toe in Discord Developer Portal:
```
https://jouw-app.vercel.app/api/auth/callback
```

## 🔍 Troubleshooting

### "OAuth error: No code"
- Check of redirect URL in Discord klopt
- Moet EXACT matchen (let op trailing slash)

### "Error fetching from Supabase"
- Check of .env.local correct is ingevuld
- Check of Supabase project actief is
- Check of SQL schema succesvol is gerund

### "User not found" na login
- Check of users table bestaat in Supabase
- Check RLS (Row Level Security) policies
- Kijk in Supabase logs voor errors

### Bot sync werkt niet
- Check of bot token correct is
- Check of Supabase credentials kloppen in bot
- Check network logs in browser (F12)

## 📞 Support

Problemen? Check:
1. Browser console (F12) voor frontend errors
2. Terminal output voor backend errors
3. Supabase logs voor database issues
4. Discord bot console voor bot errors

## 🎉 Klaar!

Je hebt nu:
- ✅ Moderne Next.js webapp
- ✅ Discord OAuth login
- ✅ Supabase database
- ✅ Bot integratie
- ✅ Customer dashboard
- ✅ Admin panel
- ✅ Real-time sync

Geniet van je volledig geïntegreerde systeem! 🚀



# 🖥️ VPS Pterodactyl Setup Guide

Complete gids om Pterodactyl op je eigen VPS te installeren en te configureren voor custom bot deployments.

---

## 🚀 Quick Start (5 minuten)

Als je al in het Pterodactyl panel bent en niet weet waar te beginnen:

1. **Maak Discord Bot Nest** → Stap 2.3
2. **Vind alle IDs** → Stap 2.2, 2.3, 2.4
3. **Maak API Key** → Stap 3
4. **Zet Environment Variables** → Stap 4
5. **Test** → Stap 5

**Belangrijk:** Noteer alle IDs die je tegenkomt - je hebt ze nodig voor de environment variables!

---

## 📋 Prerequisites

1. ✅ VPS server met root toegang
2. ✅ Domain name met DNS A-records geconfigureerd
3. ✅ Pterodactyl panel geïnstalleerd door hosting provider (of zelf installeren)
4. ✅ Toegang tot Pterodactyl admin panel (je bent hier al als je dit leest!)

---

## 🔧 Stap 1: DNS Configuration

### DNS A-records in Vercel (of je DNS provider):

Voeg deze A-records toe:

| Name | Type | Value | TTL |
|------|------|-------|-----|
| `panel` | A | `163.227.178.41` | Auto |
| `pma` | A | `163.227.178.41` | Auto |
| `node1` | A | `163.227.178.41` | Auto |

**Belangrijk:**
- Als je Cloudflare gebruikt, zet de proxy uit (DNS only)
- Wacht 5-30 minuten voor DNS propagation
- Test met: `ping panel.codecraft-solutions.com`

---

## 🔑 Stap 2: Pterodactyl Panel Setup

### 2.1 Login op Panel

1. Ga naar `https://panel.codecraft-solutions.com`
2. Login met je admin credentials (van hosting provider)

### 2.2 Configure Node & Allocations

**Stap 1: Vind je Node ID**

1. **Panel → Nodes** (in de sidebar onder "MANAGEMENT")
2. Je ziet een lijst met nodes - klik op je node (meestal is er maar één)
3. **Noteer de Node ID** - Kijk in de URL: `/admin/nodes/view/1` → ID = **1** (dit nummer!)

**Stap 2: Voeg Allocations toe (IP:Port combinaties)**

Elke server heeft een unieke IP:Port combinatie nodig. Je moet voldoende allocations hebben:

1. **Panel → Nodes → [Your Node] → Allocations** tab
2. Klik op **"Create New"** (of "Add Allocation")
3. Vul in:
   - **IP Address**: Je server IP (bijv. `163.227.178.41`)
   - **Ports**: Voeg een range toe (bijv. `25565-25575` voor 10 ports)
   - **Alias**: Optioneel (bijv. `Bot Servers`)
4. Klik **"Create"**
5. **Herhaal dit** tot je voldoende ports hebt (bijv. 50-100 ports voor veel bots)

**Tip:** Je kunt ook individuele ports toevoegen als je dat liever hebt.

### 2.3 Maak Discord Bot Nest & Egg

**Stap 1: Maak een nieuwe Nest**

1. **Panel → Nests** (je bent hier al)
2. Klik op de blauwe knop **"Create New"** (rechtsboven)
3. Vul in:
   - **Name**: `Discord Bots`
   - **Description**: `Discord bot servers for custom bot deployments`
4. Klik **"Create"**
5. **Noteer de Nest ID** - Kijk in de URL na het aanmaken: `/admin/nests/view/5` → ID = **5** (dit nummer!)

**Stap 2: Maak een Discord Bot Egg**

1. Klik op de nest die je net hebt aangemaakt (**Discord Bots**)
2. Je ziet nu een lege lijst met eggs
3. Klik op **"Create New Egg"** (of "Import Egg" als je een bestaande wilt importeren)
4. Vul de basis informatie in:
   - **Name**: `Discord Bot (Node.js)`
   - **Description**: `Discord bot server using Node.js 18`
5. Scroll naar beneden naar **"Docker Configuration"**:
   - **Docker Image**: `ghcr.io/parkervcp/yolks:nodejs_22` (of `nodejs_23` voor nieuwste versie)
   - **Docker Image EULA**: Laat leeg (of accepteer als gevraagd)
   - **Tip:** Node.js 22 is LTS (aanbevolen voor productie), Node.js 23 is nieuwer maar geen LTS
6. Scroll naar **"Startup Configuration"**:
   - **Startup Command**: `node index.js`
   - **File Denylist**: Laat leeg
7. Scroll naar **"Installation Script"**:
   - Plak dit script:
   ```bash
   #!/bin/ash
   cd /home/container
   
   # Download bot files if not present
   if [ ! -f index.js ]; then
       echo "⚠️  index.js not found - bot files will be deployed via API"
   fi
   
   # Install dependencies if package.json exists
   if [ -f package.json ]; then
       echo "📦 Installing dependencies..."
       npm install --production
   fi
   
   echo "✅ Installation complete"
   ```
8. Scroll naar **"Variables"** (Environment Variables):
   - Klik **"Add Variable"**
   - Voeg deze variabelen toe (één voor één):
     - **Variable Name**: `DISCORD_BOT_TOKEN`
       - **Description**: `Discord bot token`
       - **Default Value**: Laat leeg
       - **User Viewable**: ✅ **AAN** (zodat gebruikers het kunnen zien)
       - **User Editable**: ✅ **AAN**
       - **Required**: ✅ **AAN**
     - **Variable Name**: `GUILD_ID`
       - **Description**: `Discord guild ID`
       - **Default Value**: Laat leeg
       - **User Viewable**: ✅ **AAN**
       - **User Editable**: ✅ **AAN**
       - **Required**: ❌ **UIT**
     - **Variable Name**: `BOT_APPLICATION_ID`
       - **Description**: `Discord bot application ID`
       - **Default Value**: Laat leeg
       - **User Viewable**: ✅ **AAN**
       - **User Editable**: ✅ **AAN**
       - **Required**: ❌ **UIT**
     - **Variable Name**: `NODE_ENV`
       - **Description**: `Node environment`
       - **Default Value**: `production`
       - **User Viewable**: ✅ **AAN**
       - **User Editable**: ✅ **AAN**
       - **Required**: ❌ **UIT**
9. Klik **"Create Egg"**
10. **Noteer de Egg ID** - Kijk in de URL: `/admin/nests/egg/15` → ID = **15** (dit nummer!)

**Belangrijk:** Noteer deze IDs - je hebt ze nodig voor de environment variables!

### 2.4 Vind User ID

1. **Panel → Users** (in de sidebar onder "MANAGEMENT")
2. Klik op je admin user (meestal de eerste in de lijst)
3. **Noteer de User ID** - Kijk in de URL: `/admin/users/view/1` → ID = **1** (dit nummer!)

**Tip:** Dit is de user waaronder alle bot servers worden aangemaakt.

---

## 🔐 Stap 3: API Key Generation

### 3.1 Create Application API Key

1. **Panel → Account Settings → API Credentials**
2. Klik **"Create New"**
3. Selecteer **"Application API"** (niet Client API!)
4. **Permissions** (selecteer alle):
   - ✅ `servers.*` (create, read, update, delete)
   - ✅ `nodes.*` (read)
   - ✅ `allocations.*` (read, create)
   - ✅ `users.*` (read)
5. Klik **"Create"**
6. **Kopieer de API key** (begint met `ptlc_`) ⚠️ **Bewaar deze veilig!**

---

## ⚙️ Stap 4: Environment Variables

### 4.1 Vercel Environment Variables

Voeg deze toe in **Vercel Dashboard → Project → Settings → Environment Variables**:

```env
# Pterodactyl Panel URL
PTERODACTYL_PANEL_URL=https://panel.codecraft-solutions.com

# Pterodactyl API Key (Application API)
PTERODACTYL_API_KEY=ptlc_YOUR_API_KEY_HERE

# API Mode: 'application' for standard Pterodactyl, 'splitter' for SparkedHost
PTERODACTYL_API_MODE=application

# Pterodactyl Configuration (van Stap 2)
PTERODACTYL_DEFAULT_NODE_ID=1
PTERODACTYL_BOT_NEST_ID=5
PTERODACTYL_BOT_EGG_ID=15
PTERODACTYL_DEFAULT_USER_ID=1

# Bot Configuration
BOT_STARTUP_COMMAND=node index.js
PTERODACTYL_DOCKER_IMAGE=ghcr.io/parkervcp/yolks:nodejs_22
# Note: nodejs_22 is LTS (aanbevolen), nodejs_23 is ook beschikbaar maar geen LTS

# Auto-allocate ports (true/false)
PTERODACTYL_AUTO_ALLOCATE=true
```

**Belangrijk:**
- `PTERODACTYL_API_MODE=application` (niet `splitter`!)
- `PTERODACTYL_PARENT_SERVER_UUID` is **niet nodig** voor Application API mode
- Deploy opnieuw na het toevoegen van environment variables

---

## 🧪 Stap 5: Test Server Creation

### 5.1 Wat gebeurt er wanneer iemand een bot token invoert?

Wanneer een gebruiker een custom bot token invoert op de Bot Personalizer pagina:

1. **Token Validatie**: Het systeem valideert het token via Discord API
2. **Server Aanmaken**: Er wordt automatisch een nieuwe Pterodactyl server aangemaakt:
   - **Naam**: `comcraft-{bot-username}-{guild-id}` (bijv. `comcraft-mybot-123456`)
   - **Resources**: Starter tier (512MB RAM, 25% CPU, 2GB disk)
   - **Egg**: Discord Bot egg (geconfigureerd in Stap 2.3)
   - **Node**: De node die je hebt geconfigureerd in Stap 2.2
3. **File Deployment**: Bot files worden automatisch geüpload van GitHub:
   - `bot-comcraft.js` → `index.js`
   - `package.json`
   - `modules/` directory (recursief)
4. **Environment Variables**: Automatisch ingesteld:
   - `DISCORD_BOT_TOKEN` (van gebruiker)
   - `GUILD_ID` (van gebruiker)
   - `BOT_APPLICATION_ID` (van Discord API)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (gedeeld)
   - Andere API keys (gedeeld)
5. **Server Start**: Server wordt automatisch gestart na installatie

### 5.2 Test via Dashboard

1. Ga naar **Dashboard → Bot Personalizer**
2. Voeg een custom bot token toe
3. Klik **"Enable Bot Personalizer"**
4. Controleer de logs in Vercel:
   - ✅ `Creating server using application API mode`
   - ✅ `Found available allocation`
   - ✅ `Server created via Application API`
   - ✅ `Bot files deployed directly from GitHub`
   - ✅ `Environment variables automatically set`
   - ✅ `Pterodactyl server started`

### 5.3 Verify in Pterodactyl Panel

1. **Panel → Servers**
2. Je zou een nieuwe server moeten zien met naam zoals `comcraft-codecrafter-XXXXXX`
3. Klik op de server → Controleer:
   - ✅ Resources (RAM, CPU, Disk) zijn correct
   - ✅ Startup command is `node index.js`
   - ✅ Allocation (IP:Port) is toegewezen

---

## 🐛 Troubleshooting

### "No available allocations"

**Oplossing:** Voeg meer allocations toe in Pterodactyl:
```
Panel → Nodes → [Node] → Allocations → Create Allocation
Bijv: 163.227.178.41:25565-25575 (10 ports)
```

### "API Authentication Failed"

**Oplossing:** 
1. Controleer of je **Application API** key hebt (niet Client API)
2. Controleer permissions: `servers.*`, `nodes.*`, `allocations.*`
3. Regenerate API key als nodig

### "Invalid egg ID"

**Oplossing:** 
1. Controleer `PTERODACTYL_BOT_EGG_ID` in environment variables
2. Verifieer egg ID in panel URL: `/admin/nests/egg/15` → ID = 15

### "Server created but not starting"

**Oplossing:**
1. Controleer Docker image in egg config
2. Controleer startup command: `node index.js`
3. Controleer server logs in Pterodactyl panel

### "Node ID not found"

**Oplossing:**
1. Controleer `PTERODACTYL_DEFAULT_NODE_ID` in environment variables
2. Verifieer node ID in panel URL: `/admin/nodes/view/1` → ID = 1

---

## 📊 Verschil tussen Splitter API en Application API

### Splitter API (SparkedHost)
- ✅ Creëert **sub-servers** onder een parent server
- ✅ Vereist `PARENT_SERVER_UUID`
- ✅ Automatisch resource sharing
- ❌ Alleen beschikbaar op SparkedHost

### Application API (Standard Pterodactyl)
- ✅ Creëert **standalone servers**
- ✅ Geen parent server nodig
- ✅ Volledige controle over resources
- ✅ Werkt op elke Pterodactyl installatie
- ✅ Vereist `DEFAULT_NODE_ID`, `DEFAULT_NEST_ID`, `DEFAULT_EGG_ID`, `DEFAULT_USER_ID`

---

## 🚀 Next Steps

1. **Test eerste deployment:**
   - Voeg custom bot token toe
   - Controleer server creation
   - Verify bot files worden geüpload

2. **Monitor resources:**
   - Check server resource usage in panel
   - Pas tier configs aan als nodig (`tier-config.ts`)

3. **Scale up:**
   - Voeg meer nodes toe als nodig
   - Configure load balancing
   - Set up monitoring alerts

---

## ✅ Checklist

- [ ] DNS A-records geconfigureerd (`panel`, `pma`, `node1`)
- [ ] Pterodactyl panel toegankelijk via `https://panel.codecraft-solutions.com`
- [ ] Node ID, Nest ID, Egg ID, User ID genoteerd
- [ ] Application API key aangemaakt met juiste permissions
- [ ] Environment variables toegevoegd in Vercel
- [ ] `PTERODACTYL_API_MODE=application` gezet
- [ ] Test server creation succesvol
- [ ] Server verschijnt in Pterodactyl panel
- [ ] Bot files worden correct geüpload

---

## 🎉 Klaar!

Je VPS Pterodactyl setup is nu compleet! Custom bots worden automatisch gecreëerd wanneer gebruikers een bot token registreren.

**Elke custom bot krijgt:**
- 🤖 Eigen container/server
- 🎯 Resources gebaseerd op tier
- 📁 Automatische file deployment
- 🔄 Volledige controle via Pterodactyl panel




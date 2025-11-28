# SparkedHost Automated Provisioning Setup

## 🎯 Your Setup

**SparkedHost Ultimate Plan:**
- 7GB RAM (7168MB total)
- 300% CPU
- 100GB SSD Storage
- Max 13 Discord Bots
- Panel: https://control.sparkedhost.us

**API Type:** Client + Dedicated API ✅

---

## 🚀 Quick Setup Guide

### Step 1: API Key (REVOKE OLD ONE FIRST!)

1. **Revoke old keys** in API Credentials
2. **Create new API key:**
   - Description: "CodeCraft Automation"
   - Copy the key (starts with `ptlc_`)
   - **SAVE SECURELY** (never share again!)

### Step 2: Get Node & Egg IDs

#### Find Node ID:

Option A: **Ask SparkedHost Support**
```
Hi, I need my Dedicated Node ID for API automation.
For: /api/client/dedicated/{node_id}/servers

Thanks!
```

Option B: **Check existing server** (if you have one)
- Go to a server in panel
- Check URL or server details
- Node ID might be visible

#### Find Egg ID:

SparkedHost heeft verschillende Discord bot templates (eggs):
- `discord.py` - Example Bot
- `discord.js` - Apollo API
- `Nextcord` - Apollo API
- etc.

**Methode 1: Via Browser Developer Tools**
1. Open je SparkedHost panel
2. Open Developer Tools (F12)
3. Go to **Network** tab
4. Create a test server manually via panel
5. Watch network calls for `POST /api/client/dedicated/{node_id}/servers`
6. Check de `egg_id` in de request body

**Methode 2: Vraag aan SparkedHost Support**
```
Hi, I need the Egg ID for Discord.js bots 
for API automation via Dedicated API.

Which egg_id should I use in:
POST /api/client/dedicated/{node_id}/servers

Thanks!
```

**Methode 3: Test Met Common IDs**
Probeer in deze volgorde:
```bash
PTERODACTYL_BOT_EGG_ID=15  # Common Discord.js
PTERODACTYL_BOT_EGG_ID=14  # Alternative
PTERODACTYL_BOT_EGG_ID=5   # Generic Node.js
```

Als je error krijgt "invalid egg", probeer het volgende nummer!

**What Are Eggs?**
De "Preinstalls" die je ziet in je server → Configuration → Preinstalls zijn de verschillende "eggs" (templates). Elke heeft een uniek ID dat je nodig hebt voor API automation.

Bekende SparkedHost Discord Bot Eggs:
- **discord.js** - Voor JavaScript bots (meest gebruikt)
- **discord.py** - Voor Python bots
- **Nextcord** - Python Discord wrapper

Kies welke template je wilt gebruiken voor je klanten en vind die egg_id!

---

### Step 3: Environment Variables

**Create `.env.local` in `codecraft-webapp/`:**

```bash
# NextAuth & Discord (je hebt dit al)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-existing-secret
DISCORD_CLIENT_ID=your-existing-id
DISCORD_CLIENT_SECRET=your-existing-secret

# Supabase (je hebt dit al)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# ⬇️ NIEUW: SparkedHost Configuration ⬇️
PTERODACTYL_PANEL_URL=https://control.sparkedhost.us
PTERODACTYL_API_KEY=ptlc_YOUR_NEW_KEY_HERE

# SparkedHost IDs (test with these, adjust if needed)
PTERODACTYL_DEFAULT_NODE_ID=1
PTERODACTYL_BOT_EGG_ID=15
PTERODACTYL_DEFAULT_USER_ID=85284

# Optional (usually set in egg)
BOT_STARTUP_COMMAND=

# Security
WEBHOOK_SECRET=generate-with-openssl-rand-base64-32
```

### Step 4: Add to Vercel

Go to Vercel → Settings → Environment Variables:

Add all the `PTERODACTYL_*` and `WEBHOOK_SECRET` variables for:
- ✅ Production
- ✅ Preview  
- ✅ Development

Then **Redeploy**!

---

### Step 5: Database Setup

Run in Supabase SQL Editor:

```sql
-- File: bot-deployments-schema.sql
```

This creates:
- `bot_deployments` table
- `deployment_logs` table
- RLS policies

---

## 📊 Resource Allocation Per Tier

**Your 7GB RAM Plan Supports:**

### Starter Tier (512MB RAM, 25% CPU)
- Can host: ~**13 Starter bots** (theoretical max)
- Or mix with Pro/Business

### Pro Tier (1GB RAM, 50% CPU)
- Can host: ~**7 Pro bots**

### Business Tier (2GB RAM, 100% CPU)
- Can host: ~**3 Business bots**

### Mixed Example:
- 5x Starter (2.5GB)
- 3x Pro (3GB)
- 1x Business (2GB)
- **Total: 7.5GB** ⚠️ (slight overage, but manageable)

**Recommendation:** Monitor total allocated resources in `/admin/deployments`!

---

## 🤖 How Auto-Provisioning Works

### Automatic Flow:

```
1. Customer places order + pays
   ↓
2. Admin verifies payment in /admin/orders/[id]
   ↓
3. 🚀 AUTO-PROVISION TRIGGERED!
   ↓
4. System calls SparkedHost Dedicated API:
   POST /api/client/dedicated/{node_id}/servers
   {
     name: "bot_abc123_guildid",
     cpu: 50,
     memory: 1024,
     disk: 4096,
     egg_id: 15,
     backups: 2,
     allocations: 1
   }
   ↓
5. SparkedHost creates server
   ↓
6. Database updated with server UUID
   ↓
7. Customer sees "Bot Provisioned" in dashboard
   ↓
8. Customer configures bot token via panel
   ↓
9. Bot starts! 🎉
```

---

## 🎮 Admin Dashboard

### `/admin/deployments`

**Features:**
- ✅ See all deployed bots
- ✅ "Ready to Deploy" section
- ✅ One-click provisioning
- ✅ Suspend/Unsuspend (stop/start)
- ✅ Terminate (delete)
- ✅ Resource usage overview
- ✅ Status tracking

**Stats:**
- Total deployments
- Active bots
- Suspended bots
- Ready to provision count

---

## 🔧 SparkedHost Specific Notes

### 1. **Manual Environment Variables**

After bot is created, customer needs to:
1. Go to SparkedHost panel
2. Open their bot server
3. Go to **Startup** tab
4. Set `DISCORD_TOKEN` variable
5. Start bot

**Future Enhancement:** We could use API to set this automatically!
```
PUT /api/client/servers/{uuid}/startup/variable
{ "key": "DISCORD_TOKEN", "value": "..." }
```

### 2. **No Database Creation**

SparkedHost might not support database creation via API on shared hosting.
Bots should use:
- Supabase (external)
- JSON file storage
- Or request DB from SparkedHost support

### 3. **Resource Limits**

With your Ultimate plan:
- Monitor total RAM usage
- Don't exceed 7GB total
- Admin dashboard will show warnings

### 4. **Allocations**

SparkedHost auto-assigns IP:Port, so:
- No need to manage allocations manually
- Each bot gets unique port automatically

---

## 🧪 Testing The Setup

### Test 1: Check API Connection

```powershell
$headers = @{
    "Authorization" = "Bearer YOUR_NEW_KEY"
    "Accept" = "application/json"
}

Invoke-WebRequest -Uri "https://control.sparkedhost.us/api/client/account" -Headers $headers
```

Should return your account info ✅

### Test 2: Check Dedicated Access

```powershell
Invoke-WebRequest -Uri "https://control.sparkedhost.us/api/client/dedicated" -Headers $headers
```

Should return your dedicated node(s) ✅

### Test 3: Create Test Server (Manual)

In admin dashboard:
1. Create test order
2. Verify payment
3. Watch auto-provisioning logs
4. Check SparkedHost panel for new server

---

## 📋 Finding Egg ID

### Option 1: Create Server Manually Once

1. Go to SparkedHost panel
2. Click "Create Server"
3. Select Discord Bot template
4. Check network/console for egg_id

### Option 2: Ask Support

```
Hi, what is the Egg ID for Discord.js bots?
For API automation via /api/client/dedicated/{node_id}/servers

Thanks!
```

### Option 3: Common IDs

Try these in order:
- `15` (common for Discord bots)
- `5` (generic Node.js)
- `1` (default)

---

## 🔒 Security Best Practices

1. ✅ **NEVER** share API keys (revoke the ones you shared!)
2. ✅ Store keys ONLY in `.env.local` and Vercel
3. ✅ Use `WEBHOOK_SECRET` for internal API calls
4. ✅ RLS policies protect customer data

---

## 💡 Capacity Planning

### Current Capacity:

**7GB RAM = Can host mix of:**
- 13x Starter (512MB each) = 6.5GB ✅
- 7x Pro (1GB each) = 7GB ✅
- 3x Business (2GB each) = 6GB ✅

**Or mixed:**
- 5x Starter + 3x Pro + 1x Business = 7.5GB ⚠️

**Admin dashboard shows:**
- Total RAM allocated
- Available RAM
- Warning if >90% used

### When To Upgrade:

If you get >10 orders, consider:
- Another SparkedHost Ultimate plan
- Or upgrade to VPS with own Pterodactyl

---

## 🎉 You're Ready!

**After setup:**
1. ✅ Revoke old API keys
2. ✅ Create new key
3. ✅ Add to `.env.local` and Vercel
4. ✅ Run database schema
5. ✅ Test provisioning!

**Then:**
- Customer pays → Bot auto-created
- Admin monitors via `/admin/deployments`
- Customer controls via `/dashboard/bot`

**Your automated SaaS is LIVE!** 🚀


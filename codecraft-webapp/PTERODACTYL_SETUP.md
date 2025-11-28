# Pterodactyl Integration Setup Guide

## 🚀 Complete Automated Bot Provisioning

Deze guide helpt je om volledige automatisering te configureren waarbij bots automatisch worden provisioned na payment.

---

## 📋 Prerequisites

1. ✅ Pterodactyl Panel installed & configured
2. ✅ Discord bot code repository ready
3. ✅ Node/Egg configured in Pterodactyl for Discord bots
4. ✅ Supabase database running

---

## 🔑 Step 1: Environment Variables

**BELANGRIJK:** Deel NOOIT je API keys!

### Voeg toe aan `.env.local`:

```bash
# Pterodactyl Panel Integration
PTERODACTYL_PANEL_URL=https://panel.yourdomain.com
PTERODACTYL_API_KEY=ptlc_YOUR_NEW_API_KEY_HERE

# Pterodactyl Configuration
PTERODACTYL_DEFAULT_NODE_ID=1
PTERODACTYL_BOT_EGG_ID=15
PTERODACTYL_BOT_NEST_ID=5
PTERODACTYL_DEFAULT_USER_ID=1
PTERODACTYL_DOCKER_IMAGE=ghcr.io/parkervcp/yolks:nodejs_22

# Bot Startup Command
BOT_STARTUP_COMMAND=node index.js

# Webhook Security
WEBHOOK_SECRET=generate-random-string-here
```

### Hoe vind je deze waarden?

#### 1. **PTERODACTYL_PANEL_URL**
   - Jouw panel URL, bijv: `https://panel.example.com`

#### 2. **PTERODACTYL_API_KEY**
   - Panel → Account Settings → API Credentials
   - Create New → **Application API Key**
   - Permissions: `servers.*`, `nodes.*`, `allocations.*`, `users.*`
   - **Revoke de oude key!**

#### 3. **Node, Egg & Nest IDs**

**Node ID:**
```
Panel → Nodes → [Your Node Name] → Check URL
URL: .../admin/nodes/view/1  → ID = 1
```

**Nest ID:**
```
Panel → Nests → Discord Bots → Check URL
URL: .../admin/nests/view/5 → ID = 5
```

**Egg ID:**
```
Panel → Nests → Discord Bots → [Your Bot Egg] → Check URL
URL: .../admin/nests/egg/15 → ID = 15
```

#### 4. **Default User ID**
```
Panel → Users → [Admin User] → Check URL
URL: .../admin/users/view/1 → ID = 1
```

---

## 💾 Step 2: Database Setup

Run de deployment schema in Supabase SQL Editor:

```sql
-- Run this file:
codecraft-webapp/bot-deployments-schema.sql
```

Dit maakt:
- ✅ `bot_deployments` table
- ✅ `deployment_logs` table
- ✅ RLS policies
- ✅ Indexes voor performance

---

## 🤖 Step 3: Configure Pterodactyl Egg

### Option A: Use Existing Discord Bot Egg

If you already have a Discord bot egg, note its ID.

### Option B: Create New Egg

1. **Panel → Nests → Create New Nest**
   - Name: "Discord Bots"
   - Description: "Discord bot services"

2. **Create Egg in Nest**
   - Name: "Node.js Discord Bot"
   - Docker Image: `ghcr.io/parkervcp/yolks:nodejs_22`
   - Startup: `node index.js`

3. **Configure Variables:**
   - `DISCORD_TOKEN` (required)
   - `DISCORD_GUILD_ID` (required)
   - `TIER` (set by system)
   - `FEATURES` (set by system)

---

## 🔄 Step 4: Automation Flow

### How It Works:

```
1. Customer places order
   ↓
2. Customer pays & admin verifies payment
   ↓
3. Order status → "quote_accepted" + payment "confirmed"
   ↓
4. System automatically triggers provisioning
   ↓
5. Pterodactyl creates server with correct resources
   ↓
6. Database updated with server details
   ↓
7. Customer notified: "Your bot is being deployed!"
   ↓
8. Customer can view bot status in dashboard
```

### Trigger Points:

**Automatic provisioning happens when:**
- ✅ Payment is verified by admin
- ✅ Order has `quote_accepted` status
- ✅ Payment has `confirmed` status
- ✅ No existing deployment for order

---

## 📊 Step 5: Resource Tiers

### Pre-configured Tiers:

**Starter:**
- 512MB RAM
- 50% CPU
- 1GB Disk
- 0 Databases
- 1 Backup
- Max 1 guild

**Pro:**
- 1GB RAM
- 100% CPU
- 2GB Disk
- 1 Database
- 3 Backups
- Max 3 guilds

**Business:**
- 2GB RAM
- 200% CPU
- 5GB Disk
- 3 Databases
- 7 Backups
- Max 10 guilds

### Add-on Resource Boosts:

**Private Instance:**
- +512MB RAM
- +50% CPU
- +1GB Disk

---

## 🎮 Step 6: Test Provisioning

### Manual Test:

```typescript
// Test via admin deployment page or API
POST /api/admin/deployments/provision
{
  "orderId": "order-uuid",
  "tier": "pro",
  "discordGuildId": "123456789",
  "selectedAddons": []
}
```

### Check Logs:

```bash
# In Vercel/deployment logs:
🚀 Starting bot provisioning
✅ Server created: abc123
✅ Bot provisioned successfully
```

---

## 📱 Step 7: Customer Access

### Customer Dashboard Shows:

- ✅ Bot Status (Online/Offline/Starting)
- ✅ Resource Usage
- ✅ Server Details
- ✅ Restart Button (self-service)
- ✅ Tier & Features List

### Customer Must Configure:

- ⚠️ Discord Bot Token (in Pterodactyl panel)
- ⚙️ Initial setup via SFTP/File Manager

---

## 🛠️ Admin Dashboard Features

### `/admin/deployments` page:

**View All Deployments:**
- Status overview (Active/Suspended/Failed)
- Resource usage
- Server health

**Manual Actions:**
- Manual provision (if auto failed)
- Suspend/Unsuspend
- Update resources (tier upgrade)
- Terminate (permanent delete)

**Monitoring:**
- Deployment logs
- Error messages
- Health checks

---

## 🔒 Security Best Practices

1. ✅ **API Keys**: Store in `.env.local`, NEVER commit
2. ✅ **Webhook Security**: Use `WEBHOOK_SECRET` to verify requests
3. ✅ **RLS Policies**: Already configured (customers only see own bots)
4. ✅ **Admin Access**: Verify admin status before provisioning
5. ✅ **Rate Limiting**: Consider implementing for provision endpoint

---

## 🐛 Troubleshooting

### "No available allocations"
**Solution:** Add more IP:Port allocations in Pterodactyl
```
Panel → Nodes → [Node] → Allocation → Create Allocation
```

### "Provisioning failed: Invalid egg ID"
**Solution:** Check `PTERODACTYL_BOT_EGG_ID` matches actual egg
```
Panel → Nests → Check egg ID in URL
```

### "API Authentication Failed"
**Solution:** Regenerate API key with correct permissions
```
Panel → Account → API Credentials → Create New
Permissions: servers.*, nodes.*, allocations.*, users.*
```

### "Server created but not starting"
**Solution:** Check Docker image & startup command
```
Panel → Server → Startup → Verify command & image
```

---

## 📈 Monitoring & Health Checks

### Automatic Health Checks:

The system will periodically check:
- ✅ Server online/offline status
- ✅ Resource usage
- ✅ Automatic restart on failure (optional)

### View Deployment Logs:

```
Admin Dashboard → Deployments → [Select Server] → Logs
```

Shows:
- Provision attempts
- Power actions
- Resource updates
- Errors

---

## 🚀 Next Steps After Setup

1. **Test with real order:**
   - Create test order
   - Process payment
   - Verify auto-provision

2. **Monitor first deployment:**
   - Check Pterodactyl panel
   - Verify resources correct
   - Test bot functionality

3. **Customer onboarding:**
   - Send guide for Discord token setup
   - Provide SFTP/panel access
   - Test restart button

4. **Scale:**
   - Add more nodes as needed
   - Configure load balancing
   - Set up monitoring alerts

---

## 🎉 You're Ready!

Your automated bot provisioning system is now configured!

**Every time a customer pays:**
- 🤖 Bot server auto-created
- 🎯 Resources match their tier
- 🚀 Ready to configure & start
- 📊 Full admin control

**Questions?** Check `/admin/deployments` for status!


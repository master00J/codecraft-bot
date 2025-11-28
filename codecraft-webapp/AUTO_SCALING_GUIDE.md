# Intelligent Auto-Scaling System

## 🤖 Overzicht

Je Discord bots worden **automatisch gemonitord** en resources worden **dynamisch aangepast** op basis van gebruik. Geen over-provisioning, geen crashes door te weinig resources!

---

## 🎯 Hoe Het Werkt

### Monitoring (Elke 10 Minuten):

```
Cron Job Start
    ↓
Check alle active bot deployments
    ↓
Voor elke bot:
  - Fetch current RAM/CPU/Disk usage
  - Compare met allocated limits
  - Calculate utilization percentage
    ↓
Log usage metrics
    ↓
Analyze scaling need
    ↓
Execute scaling if needed
    ↓
Notify customer
```

### Auto-Scaling Triggers:

**Scale UP (⬆️) Wanneer:**
- RAM usage >85% voor 3+ checks (30 minuten)
- CPU usage >85% voor 3+ checks
- Disk usage >80% voor 3+ checks

**Actie:**
- +256MB RAM
- +25% CPU
- +1GB Disk
- Max limits: 2GB RAM, 200% CPU, 10GB Disk per bot

**Scale DOWN (⬇️) Wanneer:**
- RAM usage <30% voor 10+ checks (100 minuten)
- CPU usage <30% voor 10+ checks
- Disk usage <30% voor 10+ checks

**Actie:**
- -256MB RAM
- -25% CPU
- -1GB Disk
- Min limits: Tier minimums (Starter = 512MB, etc.)

---

## 📊 Voorbeeld Scenario

### Scenario 1: Bot Groeit 📈

```
Day 1: Starter bot (512MB RAM)
├─ Usage: 45% (normal)

Day 3: Bot populair, meer users
├─ Check 1: Usage 87% ⚠️
├─ Check 2: Usage 89% ⚠️
├─ Check 3: Usage 91% ⚠️
    ↓
🚀 AUTO-SCALE UP!
├─ New: 768MB RAM (+256MB)
├─ Customer notification sent
├─ Bot continues smoothly ✅
```

### Scenario 2: Bot Inactief 📉

```
Week 1: Pro bot (1GB RAM)
├─ Usage: 25% (low)

Week 2: Still low usage
├─ Check 1-10: All <30%
    ↓
💰 AUTO-SCALE DOWN!
├─ New: 768MB RAM (-256MB)
├─ Save on resources
├─ Customer notification sent
├─ Bot still runs fine ✅
```

---

## ⚙️ Configuration

### Environment Variables:

Add to Vercel:

```bash
# Cron Security
CRON_SECRET=generate-random-string-here

# Already configured:
PTERODACTYL_PANEL_URL=https://control.sparkedhost.us
PTERODACTYL_API_KEY=ptlc_YOUR_KEY
PTERODACTYL_PARENT_SERVER_UUID=66aa4b14...
```

### Vercel Cron Setup:

**File:** `vercel.json` (already created!)

```json
{
  "crons": [
    {
      "path": "/api/cron/auto-scale",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

This runs every 10 minutes automatically on Vercel! ⏰

---

## 🔒 Security

### Cron Endpoint Protection:

```
GET /api/cron/auto-scale
Header: Authorization: Bearer CRON_SECRET
```

Without correct secret → 401 Unauthorized

Only Vercel Cron or your manual trigger can call this!

---

## 📱 Customer Notifications

### When Resources Are Scaled:

**Customer sees in their dashboard:**
- 📧 "Your bot resources were automatically adjusted"
- ⬆️ "RAM increased from 512MB to 768MB"
- ✅ "No action required - bot continues running"

**In deployment logs:**
- Timestamp of scaling
- Old vs new resources
- Reason (high usage / low usage)
- Performed by: system

---

## 🎚️ Scaling Rules

### Tier-Based Limits:

**Starter Tier:**
- Min: 512MB RAM, 25% CPU, 2GB Disk
- Max: 1GB RAM, 75% CPU, 5GB Disk
- Auto-scale within these ranges

**Pro Tier:**
- Min: 1GB RAM, 50% CPU, 4GB Disk  
- Max: 2GB RAM, 150% CPU, 8GB Disk

**Business Tier:**
- Min: 2GB RAM, 100% CPU, 8GB Disk
- Max: 2GB RAM (fixed), 200% CPU, 10GB Disk

### Respects Your 7GB Total:

System checks:
```
If (total_allocated + scale_amount) > 7168MB:
  → Don't scale
  → Notify admin: "Capacity limit reached"
```

---

## 📊 Admin Monitoring

### Dashboard Shows:

**Resource Usage Card (Live):**
- RAM: 6.4GB / 7GB (90%)
- CPU: 290% / 300%
- Disk: Usage per bot

**Per Bot:**
- Current usage (live)
- Allocated limits
- Last scaling action
- Utilization percentage

**Logs Tab:**
- Auto-scaling history
- Resource checks
- Decisions made
- Customer notifications

---

## 🧪 Testing Auto-Scale

### Manual Trigger (For Testing):

```bash
# Call cron endpoint manually
curl https://codecraft-solutions-seven.vercel.app/api/cron/auto-scale \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

This runs ONE auto-scale check immediately!

### Test Scenario:

1. Create test bot with 512MB RAM
2. Manually allocate higher usage in database (fake it)
3. Trigger cron
4. Watch resources increase
5. Check deployment_logs for actions

---

## 💡 Smart Features

### 1. **Prevents Thrashing**

System won't scale up/down repeatedly:
- Scale up needs 3 consecutive high checks
- Scale down needs 10 consecutive low checks
- Prevents oscillation

### 2. **Gradual Scaling**

Incremental changes:
- Not 512MB → 2GB instantly
- But 512MB → 768MB → 1GB → ...
- Smooth transitions

### 3. **Cost Optimization**

Automatically reduces resources when not needed:
- Bot inactive at night? Scale down!
- Bot busy during day? Scale up!
- Saves capacity for other bots

### 4. **Respects Tier Limits**

Won't scale Starter bot to Business resources:
- Each tier has min/max caps
- Scaling respects these limits
- Customer must upgrade tier for more

### 5. **Safety Limits**

- Max 2GB RAM per bot (prevents one bot eating all resources)
- Max 200% CPU per bot
- Max 10GB disk per bot
- Can't scale beyond plan total (7GB)

---

## 🎯 Benefits

### For You (Admin):
- ✅ **Hands-off** resource management
- ✅ **Optimal** capacity utilization
- ✅ **No manual** resizing needed
- ✅ **Prevents** out-of-memory crashes
- ✅ **Maximizes** customer satisfaction

### For Customers:
- ✅ **Always** enough resources
- ✅ **Never** overpaying for unused capacity
- ✅ **Automatic** performance optimization
- ✅ **Transparent** - see all changes
- ✅ **No downtime** during scaling

---

## 📈 Expected Results

### Week 1:
- Most bots start at tier minimum (512MB)
- Active bots scale up to 768-1024MB
- Inactive bots stay at 512MB

### Month 1:
- Busy bots settle at optimal size
- Inactive bots scaled down
- ~20% better capacity utilization

### Long Term:
- Predictive scaling patterns emerge
- Rarely hit capacity limits
- Happy customers with smooth bots!

---

## 🛠️ Customization

### Adjust Thresholds:

Edit `src/lib/pterodactyl/auto-scaling.ts`:

```typescript
const SCALING_THRESHOLDS = {
  scale_up: {
    memory: 85,  // ← Change to 90 for less aggressive
    cpu: 85,
    disk: 80
  },
  scale_down: {
    memory: 30,  // ← Change to 20 for more aggressive
    cpu: 30,
    disk: 30
  },
  checks_before_scale_up: 3,   // ← More checks = slower reaction
  checks_before_scale_down: 10
}
```

### Adjust Increments:

```typescript
const RESOURCE_INCREMENTS = {
  memory_mb: 256,  // ← Change to 512 for bigger jumps
  cpu_percent: 25,
  disk_mb: 1024
}
```

---

## 🎉 Setup Complete!

Your bots now have:
- 🤖 Automatic resource monitoring
- 📈 Intelligent scaling
- 💰 Cost optimization
- 👥 Customer transparency
- 🔔 Automatic notifications

**All running in the background, every 10 minutes, completely automated!** 🚀

---

## 📋 Final Checklist:

- [ ] `vercel.json` committed (cron config)
- [ ] `CRON_SECRET` added to Vercel env variables
- [ ] Deploy to Vercel (cron auto-activates)
- [ ] Test manual trigger
- [ ] Monitor first auto-scaling
- [ ] Check customer notifications work

**Then sit back and watch the magic! ✨**


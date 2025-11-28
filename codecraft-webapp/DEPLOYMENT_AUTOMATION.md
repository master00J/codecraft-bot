# Discord Bot Deployment Automation

## Strategie: Semi-Automated Provisioning

### Flow Overzicht

```
Order → Payment → Verification → Deployment Config → Admin Review → Provision
```

## Database Schema Extension

```sql
-- Add to orders table or create new table
CREATE TABLE IF NOT EXISTS bot_deployments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Bot Configuration
  guild_id TEXT NOT NULL,
  bot_token TEXT, -- Encrypted
  tier TEXT NOT NULL, -- starter/pro/business
  
  -- Resource Allocation (based on tier)
  memory_mb INTEGER NOT NULL,
  cpu_cores DECIMAL NOT NULL,
  storage_gb INTEGER NOT NULL,
  
  -- Features enabled (based on addons)
  enabled_features TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Apollo Panel Info
  apollo_bot_id TEXT,
  apollo_server_id TEXT,
  deployment_url TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, provisioning, active, suspended, failed
  provisioned_at TIMESTAMP WITH TIME ZONE,
  last_health_check TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_deployments_order ON bot_deployments(order_id);
CREATE INDEX idx_deployments_guild ON bot_deployments(guild_id);
CREATE INDEX idx_deployments_status ON bot_deployments(status);
```

## Tier Resource Configuration

```typescript
// codecraft-webapp/src/lib/tier-resources.ts

export const TIER_RESOURCES = {
  starter: {
    memory_mb: 512,
    cpu_cores: 0.5,
    storage_gb: 1,
    max_guilds: 1,
    features: ['basic_commands', 'moderation'],
    rate_limits: {
      commands_per_minute: 30,
      api_calls_per_day: 1000
    }
  },
  pro: {
    memory_mb: 1024,
    cpu_cores: 1,
    storage_gb: 5,
    max_guilds: 3,
    features: ['basic_commands', 'moderation', 'custom_commands', 'analytics'],
    rate_limits: {
      commands_per_minute: 100,
      api_calls_per_day: 10000
    }
  },
  business: {
    memory_mb: 2048,
    cpu_cores: 2,
    storage_gb: 10,
    max_guilds: 10,
    features: ['all'],
    rate_limits: {
      commands_per_minute: 500,
      api_calls_per_day: 100000
    }
  }
}

export const ADDON_FEATURES = {
  'priority_support': {
    support_channel: 'priority',
    response_sla: '< 1 hour'
  },
  'white_label': {
    custom_branding: true,
    custom_domain: true,
    remove_watermark: true
  },
  'private_instance': {
    dedicated_server: true,
    isolated_resources: true
  },
  'source_code': {
    repo_access: true,
    self_host: true
  }
}

export function getDeploymentConfig(order: Order) {
  const tierConfig = TIER_RESOURCES[order.tier]
  const addonFeatures = order.selected_addons.map(
    addon => ADDON_FEATURES[addon.id] || {}
  )
  
  return {
    resources: tierConfig,
    features: [
      ...tierConfig.features,
      ...addonFeatures.flatMap(a => Object.keys(a))
    ],
    addons: addonFeatures
  }
}
```

## Admin Dashboard Integration

### 1. "Ready to Deploy" Section

```typescript
// /app/admin/deployments/page.tsx

// Shows orders that are paid & verified but not deployed yet
const pendingDeployments = orders.filter(
  order => order.status === 'quote_accepted' && 
           order.payment_status === 'confirmed' &&
           !order.deployment_id
)

// Display with "Provision Bot" button
```

### 2. Deployment Config Generator

```typescript
// When admin clicks "Provision Bot"
function generateDeploymentScript(order: Order) {
  const config = getDeploymentConfig(order)
  
  return `
# Discord Bot Deployment - Order ${order.id}
# Customer: ${order.user.discord_tag}
# Guild ID: ${order.discord_guild_id}
# Tier: ${order.tier}

## Apollo Panel Configuration:

1. Create New Bot Instance
   - Name: bot_${order.id}_${order.discord_guild_id}
   - Memory: ${config.resources.memory_mb}MB
   - CPU: ${config.resources.cpu_cores} cores
   - Storage: ${config.resources.storage_gb}GB

2. Environment Variables:
   BOT_TOKEN=<discord_bot_token>
   GUILD_ID=${order.discord_guild_id}
   TIER=${order.tier}
   FEATURES=${config.features.join(',')}
   DATABASE_URL=<your_supabase_url>
   ORDER_ID=${order.id}

3. Enable Features:
${config.features.map(f => `   - ${f}`).join('\n')}

4. Deploy Command:
   git clone <your_bot_repo>
   npm install
   npm run start:${order.tier}
`
}
```

### 3. One-Click Copy Config

```tsx
<Card>
  <CardHeader>
    <CardTitle>Deploy Bot - Order #{order.id}</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {/* Customer Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Customer</Label>
          <p className="font-mono">{order.user.discord_tag}</p>
        </div>
        <div>
          <Label>Guild ID</Label>
          <p className="font-mono">{order.discord_guild_id}</p>
        </div>
      </div>
      
      {/* Resource Config */}
      <div className="border rounded p-4 bg-muted">
        <h4 className="font-semibold mb-2">Resource Allocation</h4>
        <ul className="space-y-1 text-sm">
          <li>Memory: {config.resources.memory_mb}MB</li>
          <li>CPU: {config.resources.cpu_cores} cores</li>
          <li>Storage: {config.resources.storage_gb}GB</li>
        </ul>
      </div>
      
      {/* Deployment Script */}
      <div>
        <Label>Deployment Configuration</Label>
        <Textarea 
          value={deploymentScript} 
          readOnly 
          rows={15}
          className="font-mono text-xs"
        />
        <Button 
          onClick={() => copyToClipboard(deploymentScript)}
          className="mt-2"
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy Config
        </Button>
      </div>
      
      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          onClick={() => window.open('https://apollo.panel.url', '_blank')}
        >
          Open Apollo Panel
        </Button>
        <Button 
          variant="outline"
          onClick={() => markAsDeployed(order.id)}
        >
          Mark as Deployed
        </Button>
      </div>
    </div>
  </CardContent>
</Card>
```

## Automation via Webhooks (Optional)

Als je later wilt automatiseren:

```typescript
// Apollo webhook endpoint
// /app/api/webhooks/apollo/route.ts

export async function POST(request: Request) {
  const { event, bot_id, status, guild_id } = await request.json()
  
  if (event === 'bot.deployed') {
    // Update deployment status
    await supabase
      .from('bot_deployments')
      .update({
        status: 'active',
        apollo_bot_id: bot_id,
        provisioned_at: new Date().toISOString()
      })
      .eq('guild_id', guild_id)
    
    // Notify customer
    await sendDiscordNotification(guild_id, {
      title: "🎉 Your bot is live!",
      description: "Your Discord bot has been successfully deployed."
    })
  }
  
  return Response.json({ success: true })
}
```

## Best Practices

### 1. **Start Semi-Automated**
- Admin review before each deployment
- Manual quality control
- Learn patterns before full automation

### 2. **Track Everything**
- Save deployment configs
- Log all provisioning attempts
- Monitor bot health

### 3. **Graceful Scaling**
```typescript
// When customer upgrades tier
async function upgradeBotResources(deployment_id, new_tier) {
  const newConfig = TIER_RESOURCES[new_tier]
  
  // Update Apollo resources
  await apolloPanel.updateBot(deployment_id, {
    memory: newConfig.memory_mb,
    cpu: newConfig.cpu_cores
  })
  
  // Update database
  await supabase
    .from('bot_deployments')
    .update({ tier: new_tier })
    .eq('id', deployment_id)
}
```

### 4. **Suspension on Non-Payment**
```typescript
async function handleSubscriptionExpired(order_id) {
  const deployment = await getDeployment(order_id)
  
  // Suspend bot (don't delete - data preservation)
  await apolloPanel.suspendBot(deployment.apollo_bot_id)
  
  await supabase
    .from('bot_deployments')
    .update({ status: 'suspended' })
    .eq('order_id', order_id)
}
```

## Alternative: Docker + Pterodactyl

Als Apollo Panel niet ideaal is:

```yaml
# docker-compose.yml per customer
version: '3.8'
services:
  discord-bot-{order_id}:
    image: your-bot-image:latest
    environment:
      - TIER=${tier}
      - GUILD_ID=${guild_id}
      - FEATURES=${features}
    deploy:
      resources:
        limits:
          cpus: '${cpu_cores}'
          memory: ${memory_mb}M
```

## Monitoring & Health Checks

```typescript
// Cron job: check bot health every 5 minutes
async function checkBotHealth() {
  const deployments = await getActiveDeployments()
  
  for (const deployment of deployments) {
    const health = await apolloPanel.getBotStatus(deployment.apollo_bot_id)
    
    if (health.status === 'offline') {
      // Alert admin
      await notifyAdmin({
        title: "Bot Offline",
        deployment_id: deployment.id,
        guild_id: deployment.guild_id
      })
      
      // Auto-restart attempt
      await apolloPanel.restartBot(deployment.apollo_bot_id)
    }
    
    // Update last health check
    await supabase
      .from('bot_deployments')
      .update({ last_health_check: new Date().toISOString() })
      .eq('id', deployment.id)
  }
}
```


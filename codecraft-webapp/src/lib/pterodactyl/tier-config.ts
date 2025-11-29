// Tier Resource Configuration for Discord Bots

export interface TierConfig {
  memory_mb: number
  cpu_percent: number
  disk_mb: number
  swap_mb: number
  io_weight: number
  databases: number
  backups: number
  features: string[]
  max_guilds: number
}

// Optimized for SparkedHost Ultimate Plan:
// 7GB RAM total (7168MB), 300% CPU, 100GB disk, max 13 bots
export const TIER_CONFIGS: Record<string, TierConfig> = {
  starter: {
    memory_mb: 512, // ~14 bots possible (512MB each)
    cpu_percent: 25, // 25% of 300% = reasonable for basic bot
    disk_mb: 2048, // 2GB disk per bot
    swap_mb: 0,
    io_weight: 500,
    databases: 0,
    backups: 1,
    features: [
      'basic_commands',
      'moderation',
      'welcome_messages'
    ],
    max_guilds: 1
  },
  pro: {
    memory_mb: 1024, // ~7 bots possible (1GB each)
    cpu_percent: 50, // 50% of 300%
    disk_mb: 4096, // 4GB disk
    swap_mb: 0,
    io_weight: 500,
    databases: 0, // SparkedHost might not support DB creation via API
    backups: 2,
    features: [
      'basic_commands',
      'moderation',
      'welcome_messages',
      'custom_commands',
      'automod',
      'logging',
      'analytics'
    ],
    max_guilds: 3
  },
  business: {
    memory_mb: 2048, // ~3 bots possible (2GB each)
    cpu_percent: 100, // 100% of 300%
    disk_mb: 8192, // 8GB disk
    swap_mb: 0,
    io_weight: 500,
    databases: 0, // SparkedHost might not support DB creation via API
    backups: 3,
    features: [
      'all',
      'priority_queue',
      'dedicated_support',
      'custom_branding'
    ],
    max_guilds: 10
  }
}

export interface AddonConfig {
  id: string
  features?: string[]
  resource_boost?: {
    memory_mb?: number
    cpu_percent?: number
    disk_mb?: number
  }
  environment?: Record<string, string>
}

// Add-on configs (optimized for shared hosting)
export const ADDON_CONFIGS: Record<string, AddonConfig> = {
  priority_support: {
    id: 'priority_support',
    features: ['priority_queue', 'sla_support'],
    environment: {
      SUPPORT_TIER: 'priority'
    }
  },
  white_label: {
    id: 'white_label',
    features: ['custom_branding', 'remove_watermark', 'custom_domain'],
    environment: {
      WHITE_LABEL: 'true',
      BRANDING: 'custom'
    }
  },
  extra_resources: {
    id: 'extra_resources',
    features: ['enhanced_performance'],
    resource_boost: {
      memory_mb: 256, // +256MB RAM
      cpu_percent: 25, // +25% CPU
      disk_mb: 1024 // +1GB disk
    },
    environment: {
      PERFORMANCE_MODE: 'enhanced'
    }
  },
  source_code: {
    id: 'source_code',
    features: ['source_access', 'self_host'],
    environment: {
      LICENSE_TYPE: 'source'
    }
  }
}

export function getDeploymentConfig(tier: string, addons: any[] = []) {
  const baseConfig = TIER_CONFIGS[tier] || TIER_CONFIGS.starter
  
  // Apply addon boosts
  let finalConfig = { ...baseConfig }
  let enabledFeatures = [...baseConfig.features]
  let environment: Record<string, string> = {
    TIER: tier.toUpperCase(),
    MAX_GUILDS: baseConfig.max_guilds.toString()
  }

  for (const addon of addons) {
    const addonId = typeof addon === 'string' ? addon : addon.id
    const addonConfig = ADDON_CONFIGS[addonId]
    
    if (!addonConfig) continue

    // Add addon features
    if (addonConfig.features) {
      enabledFeatures.push(...addonConfig.features)
    }

    // Apply resource boosts
    if (addonConfig.resource_boost) {
      if (addonConfig.resource_boost.memory_mb) {
        finalConfig.memory_mb += addonConfig.resource_boost.memory_mb
      }
      if (addonConfig.resource_boost.cpu_percent) {
        finalConfig.cpu_percent += addonConfig.resource_boost.cpu_percent
      }
      if (addonConfig.resource_boost.disk_mb) {
        finalConfig.disk_mb += addonConfig.resource_boost.disk_mb
      }
    }

    // Add environment variables
    if (addonConfig.environment) {
      environment = { ...environment, ...addonConfig.environment }
    }
  }

  // Add features to environment
  environment.FEATURES = enabledFeatures.join(',')

  return {
    resources: finalConfig,
    features: enabledFeatures,
    environment
  }
}

// Pterodactyl Configuration
export const PTERODACTYL_CONFIG = {
  // API Mode: 'splitter' for SparkedHost sub-servers, 'application' for standard Pterodactyl
  API_MODE: process.env.PTERODACTYL_API_MODE || 'splitter', // 'splitter' | 'application'
  
  // For Splitter API (SparkedHost): Your main server UUID - sub-servers are created under this
  // For Application API (Standard Pterodactyl): Not used (leave empty)
  // To find the UUID: Go to Pterodactyl Panel → Click on server → Look at URL or server settings
  // Or use the API: GET /api/application/servers?filter[name]=comcraft
  PARENT_SERVER_UUID: process.env.PTERODACTYL_PARENT_SERVER_UUID || '',
  
  // Egg ID for Discord bot servers
  DEFAULT_EGG_ID: parseInt(process.env.PTERODACTYL_BOT_EGG_ID || '15'),
  
  // For Application API: Node ID where servers will be created
  // For Splitter API: Not used
  DEFAULT_NODE_ID: parseInt(process.env.PTERODACTYL_DEFAULT_NODE_ID || '1'),
  DEFAULT_NEST_ID: parseInt(process.env.PTERODACTYL_BOT_NEST_ID || '1'),
  
  // Default user ID (for Application API)
  DEFAULT_USER_ID: parseInt(process.env.PTERODACTYL_DEFAULT_USER_ID || '1'),
  
  // Startup command (optional)
  STARTUP_COMMAND: process.env.BOT_STARTUP_COMMAND || 'bash start.sh',
  
  // Docker image (set in egg)
  // Note: nodejs_22 is LTS (recommended), nodejs_23 is also available but not LTS
  DOCKER_IMAGE: process.env.PTERODACTYL_DOCKER_IMAGE || 'ghcr.io/parkervcp/yolks:nodejs_22',
  
  // Auto-allocate port (for Application API)
  AUTO_ALLOCATE: process.env.PTERODACTYL_AUTO_ALLOCATE === 'true',
  
  // Splitter specific settings (only for Splitter API)
  COPY_SUBUSERS: false,
  LOCALHOST_NETWORKING: false
}

export function getServerName(orderId: string, guildId: string): string {
  return `bot_${orderId.substring(0, 8)}_${guildId}`
}


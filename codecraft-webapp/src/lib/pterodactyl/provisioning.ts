// Automated Bot Provisioning Service

import { getPterodactylClient } from './client'
import { getDeploymentConfig, getServerName, PTERODACTYL_CONFIG } from './tier-config'
import { supabaseAdmin } from '@/lib/supabase/server'

interface ProvisioningOptions {
  orderId: string
  tier: string
  discordGuildId: string
  customerDiscordId: string
  selectedAddons?: any[]
  userId?: number // Pterodactyl user ID
  allocationId?: number // Specific allocation
}

interface ProvisioningResult {
  success: boolean
  deploymentId?: string
  serverId?: string
  error?: string
}

export async function provisionBot(
  options: ProvisioningOptions
): Promise<ProvisioningResult> {
  const client = getPterodactylClient()
  
  console.log('🚀 Starting bot provisioning:', {
    orderId: options.orderId,
    tier: options.tier,
    guildId: options.discordGuildId
  })

  try {
    // 1. Get deployment configuration
    const config = getDeploymentConfig(options.tier, options.selectedAddons || [])
    const serverName = getServerName(options.orderId, options.discordGuildId)

    // 2. Create deployment record in database (pending)
    const { data: deployment, error: dbError } = await supabaseAdmin
      .from('bot_deployments')
      .insert({
        order_id: options.orderId,
        discord_guild_id: options.discordGuildId,
        customer_discord_id: options.customerDiscordId,
        tier: options.tier,
        enabled_features: config.features,
        selected_addons: options.selectedAddons || [],
        memory_mb: config.resources.memory_mb,
        cpu_percent: config.resources.cpu_percent,
        disk_mb: config.resources.disk_mb,
        databases: config.resources.databases,
        backups: config.resources.backups,
        status: 'provisioning'
      })
      .select()
      .single()

    if (dbError || !deployment) {
      throw new Error(`Database error: ${dbError?.message}`)
    }

    await logDeploymentAction(deployment.id, 'provision', 'pending', {
      tier: options.tier,
      resources: config.resources
    })

    // 3. Get or create Pterodactyl user
    let pterodactylUserId = options.userId
    if (!pterodactylUserId) {
      // Default to admin user or create customer user
      pterodactylUserId = parseInt(process.env.PTERODACTYL_DEFAULT_USER_ID || '1')
    }

    // 4. Prepare environment variables
    // Note: Splitter API doesn't support environment variables on creation
    // These must be set manually or via /api/client/servers/{uuid}/startup/variable after creation
    const environment = {
      ...config.environment,
      // Discord bot specific
      DISCORD_GUILD_ID: options.discordGuildId,
      DISCORD_TOKEN: '${DISCORD_TOKEN}', // User will set this later
      
      // Database connection
      DATABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      
      // Order & customer info
      ORDER_ID: options.orderId,
      CUSTOMER_ID: options.customerDiscordId,
      
      // Feature flags
      NODE_ENV: 'production'
    }

    // 6. Create sub-server in SparkedHost (Splitter API)
    // This creates a sub-server under your main "Osrsbay" server
    const serverConfig = {
      name: serverName,
      cpu: config.resources.cpu_percent, // Integer (50 = 50%)
      memory: config.resources.memory_mb, // Integer MB
      disk: config.resources.disk_mb, // Integer MB
      egg_id: PTERODACTYL_CONFIG.DEFAULT_EGG_ID,
      copy_subusers: PTERODACTYL_CONFIG.COPY_SUBUSERS,
      localhost_networking: PTERODACTYL_CONFIG.LOCALHOST_NETWORKING
    }

    console.log('📦 Creating sub-server with config:', serverConfig)
    console.log('📦 Parent server UUID:', PTERODACTYL_CONFIG.PARENT_SERVER_UUID)

    const server = await client.createServer(serverConfig)

    // 7. Update deployment with server info
    await supabaseAdmin
      .from('bot_deployments')
      .update({
        pterodactyl_server_id: server.id.toString(),
        pterodactyl_identifier: server.identifier,
        server_uuid: server.uuid,
        status: 'active',
        health_status: 'starting',
        provisioned_at: new Date().toISOString()
      })
      .eq('id', deployment.id)

    await logDeploymentAction(deployment.id, 'provision', 'success', {
      server_id: server.id,
      identifier: server.identifier
    })

    console.log('✅ Bot provisioned successfully:', {
      deploymentId: deployment.id,
      serverId: server.identifier
    })

    // 8. Update order status
    await supabaseAdmin
      .from('orders')
      .update({ 
        status: 'in_progress',
        deployment_id: deployment.id
      })
      .eq('id', options.orderId)

    // 9. Send Discord notification to customer
    try {
      const botWebhookUrl = process.env.DISCORD_BOT_WEBHOOK_URL
      if (botWebhookUrl) {
        await fetch(botWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DISCORD_BOT_TOKEN}`
          },
          body: JSON.stringify({
            type: 'bot.deployed',
            discordId: options.customerDiscordId,
            data: {
              order_id: options.orderId,
              server_name: serverName,
              discord_guild_id: options.discordGuildId,
              tier: options.tier,
              memory_mb: config.resources.memory_mb,
              cpu_percent: config.resources.cpu_percent,
              disk_mb: config.resources.disk_mb
            }
          })
        })
        console.log('📬 Discord notification sent for bot deployment')
      }
    } catch (error) {
      console.warn('⚠️ Failed to send Discord notification:', error)
      // Don't fail deployment if notification fails
    }

    return {
      success: true,
      deploymentId: deployment.id,
      serverId: server.identifier
    }

  } catch (error) {
    console.error('❌ Provisioning failed:', error)

    // Log failure
    if (error instanceof Error) {
      await supabaseAdmin
        .from('bot_deployments')
        .update({
          status: 'failed',
          error_message: error.message
        })
        .eq('order_id', options.orderId)

      await logDeploymentAction(
        (await getDeploymentByOrderId(options.orderId))?.id || '',
        'provision',
        'failed',
        { error: error.message }
      )
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Suspend bot (non-payment)
export async function suspendBot(deploymentId: string): Promise<boolean> {
  const client = getPterodactylClient()

  try {
    const { data: deployment } = await supabaseAdmin
      .from('bot_deployments')
      .select('*')
      .eq('id', deploymentId)
      .single()

    if (!deployment || !deployment.pterodactyl_server_id) {
      throw new Error('Deployment not found')
    }

    await client.suspendServer(deployment.pterodactyl_server_id)

    await supabaseAdmin
      .from('bot_deployments')
      .update({
        status: 'suspended',
        suspended_at: new Date().toISOString()
      })
      .eq('id', deploymentId)

    await logDeploymentAction(deploymentId, 'suspend', 'success', {
      reason: 'non_payment'
    })

    return true
  } catch (error) {
    console.error('Failed to suspend bot:', error)
    return false
  }
}

// Unsuspend bot (payment received)
export async function unsuspendBot(deploymentId: string): Promise<boolean> {
  const client = getPterodactylClient()

  try {
    const { data: deployment } = await supabaseAdmin
      .from('bot_deployments')
      .select('*')
      .eq('id', deploymentId)
      .single()

    if (!deployment || !deployment.pterodactyl_server_id) {
      throw new Error('Deployment not found')
    }

    await client.unsuspendServer(deployment.pterodactyl_server_id)

    await supabaseAdmin
      .from('bot_deployments')
      .update({
        status: 'active',
        suspended_at: null
      })
      .eq('id', deploymentId)

    await logDeploymentAction(deploymentId, 'unsuspend', 'success', {})

    return true
  } catch (error) {
    console.error('Failed to unsuspend bot:', error)
    return false
  }
}

// Update resources (tier upgrade)
export async function updateBotResources(
  deploymentId: string,
  newTier: string,
  newAddons: any[] = []
): Promise<boolean> {
  const client = getPterodactylClient()

  try {
    const { data: deployment } = await supabaseAdmin
      .from('bot_deployments')
      .select('*')
      .eq('id', deploymentId)
      .single()

    if (!deployment || !deployment.pterodactyl_server_id) {
      throw new Error('Deployment not found')
    }

    const newConfig = getDeploymentConfig(newTier, newAddons)

    await client.updateServerResources(deployment.pterodactyl_server_id, {
      memory: newConfig.resources.memory_mb,
      cpu: newConfig.resources.cpu_percent,
      disk: newConfig.resources.disk_mb,
      swap: newConfig.resources.swap_mb,
      io: newConfig.resources.io_weight
    })

    await supabaseAdmin
      .from('bot_deployments')
      .update({
        tier: newTier,
        enabled_features: newConfig.features,
        selected_addons: newAddons,
        memory_mb: newConfig.resources.memory_mb,
        cpu_percent: newConfig.resources.cpu_percent,
        disk_mb: newConfig.resources.disk_mb
      })
      .eq('id', deploymentId)

    await logDeploymentAction(deploymentId, 'update_resources', 'success', {
      old_tier: deployment.tier,
      new_tier: newTier,
      new_resources: newConfig.resources
    })

    return true
  } catch (error) {
    console.error('Failed to update bot resources:', error)
    return false
  }
}

// Terminate bot (permanent deletion)
export async function terminateBot(deploymentId: string): Promise<boolean> {
  const client = getPterodactylClient()

  try {
    const { data: deployment } = await supabaseAdmin
      .from('bot_deployments')
      .select('*')
      .eq('id', deploymentId)
      .single()

    if (!deployment || !deployment.pterodactyl_server_id) {
      throw new Error('Deployment not found')
    }

    await client.deleteServer(deployment.pterodactyl_server_id)

    await supabaseAdmin
      .from('bot_deployments')
      .update({
        status: 'terminated',
        terminated_at: new Date().toISOString()
      })
      .eq('id', deploymentId)

    await logDeploymentAction(deploymentId, 'terminate', 'success', {})

    return true
  } catch (error) {
    console.error('Failed to terminate bot:', error)
    return false
  }
}

// Helper functions
async function logDeploymentAction(
  deploymentId: string,
  action: string,
  status: string,
  details: any = {},
  performedBy: string = 'system'
) {
  await supabaseAdmin.from('deployment_logs').insert({
    deployment_id: deploymentId,
    action,
    status,
    details,
    performed_by: performedBy
  })
}

async function getDeploymentByOrderId(orderId: string) {
  const { data } = await supabaseAdmin
    .from('bot_deployments')
    .select('*')
    .eq('order_id', orderId)
    .single()
  
  return data
}


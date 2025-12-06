import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getPterodactylClient } from '@/lib/pterodactyl/client'

export const dynamic = 'force-dynamic'

// Get bot status and resource usage for customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {

  const { orderId } = await params;

  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // @ts-ignore
    const customerDiscordId = session.user.discordId

    // Get deployment for this order
    const { data: deployment, error } = await supabaseAdmin
      .from('bot_deployments')
      .select(`
        *,
        orders(
          id,
          service_type,
          service_name,
          users(discord_id)
        )
      `)
      .eq('order_id', params.orderId)
      .single()

    if (error || !deployment) {
      return NextResponse.json(
        { error: 'Bot deployment not found' },
        { status: 404 }
      )
    }

    // Verify customer owns this order
    const orderDiscordId = deployment.orders?.users?.discord_id
    if (orderDiscordId !== customerDiscordId) {
      return NextResponse.json(
        { error: 'Unauthorized - Not your bot' },
        { status: 403 }
      )
    }

    // Get live resource usage from Pterodactyl
    const client = getPterodactylClient()
    let liveResources = null
    let serverInfo = null

    try {
      // Get server details
      serverInfo = await client.getServer(deployment.server_uuid)
      
      // Get resource usage
      const resources = await client.getServerResources(deployment.server_uuid)
      
      liveResources = {
        status: resources.current_state,
        is_suspended: resources.is_suspended,
        current: {
          memory_bytes: resources.resources?.memory_bytes || 0,
          memory_mb: Math.round((resources.resources?.memory_bytes || 0) / 1024 / 1024),
          cpu_absolute: resources.resources?.cpu_absolute || 0,
          disk_bytes: resources.resources?.disk_bytes || 0,
          disk_mb: Math.round((resources.resources?.disk_bytes || 0) / 1024 / 1024),
          network_rx_mb: Math.round((resources.resources?.network_rx_bytes || 0) / 1024 / 1024),
          network_tx_mb: Math.round((resources.resources?.network_tx_bytes || 0) / 1024 / 1024),
        },
        limits: {
          memory_mb: deployment.memory_mb,
          cpu_percent: deployment.cpu_percent,
          disk_mb: deployment.disk_mb
        },
        utilization_percent: {
          memory: Math.round(((resources.resources?.memory_bytes || 0) / 1024 / 1024 / deployment.memory_mb) * 100),
          cpu: Math.round(((resources.resources?.cpu_absolute || 0) / deployment.cpu_percent) * 100),
          disk: Math.round(((resources.resources?.disk_bytes || 0) / 1024 / 1024 / deployment.disk_mb) * 100)
        }
      }
    } catch (error) {
      console.error('Failed to get live resources:', error)
    }

    // Check if upgrade recommended
    const recommendUpgrade = 
      (liveResources?.utilization_percent.memory || 0) > 80 ||
      (liveResources?.utilization_percent.cpu || 0) > 80 ||
      (liveResources?.utilization_percent.disk || 0) > 80

    return NextResponse.json({
      deployment: {
        id: deployment.id,
        status: deployment.status,
        tier: deployment.tier,
        discord_guild_id: deployment.discord_guild_id,
        provisioned_at: deployment.provisioned_at,
        features: deployment.enabled_features,
      },
      server: serverInfo,
      resources: liveResources,
      recommendations: {
        upgrade: recommendUpgrade,
        current_tier: deployment.tier,
        suggested_tier: recommendUpgrade 
          ? (deployment.tier === 'starter' ? 'pro' : 'business')
          : null,
        reason: recommendUpgrade 
          ? 'Your bot is using over 80% of allocated resources'
          : null
      }
    })

  } catch (error) {
    console.error('Error fetching bot status:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}


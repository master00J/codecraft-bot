import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPterodactylClient } from '@/lib/pterodactyl/client'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Get resource utilization for all sub-servers
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // @ts-ignore
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const client = getPterodactylClient()

    // Get all sub-servers
    const subServers = await client.listSubServers()

    // Get resource usage for each sub-server
    const resourcePromises = subServers.map(async (serverData: any) => {
      const server = serverData.attributes || serverData
      const uuid = server.uuid || server.identifier

      try {
        const resources = await client.getServerResources(uuid)
        
        return {
          uuid,
          name: server.name,
          status: resources.current_state,
          is_suspended: resources.is_suspended,
          resources: {
            memory_bytes: resources.resources?.memory_bytes || 0,
            memory_mb: Math.round((resources.resources?.memory_bytes || 0) / 1024 / 1024),
            cpu_absolute: resources.resources?.cpu_absolute || 0,
            disk_bytes: resources.resources?.disk_bytes || 0,
            disk_mb: Math.round((resources.resources?.disk_bytes || 0) / 1024 / 1024),
            network_rx_bytes: resources.resources?.network_rx_bytes || 0,
            network_tx_bytes: resources.resources?.network_tx_bytes || 0,
          },
          limits: server.limits || {}
        }
      } catch (error) {
        console.error(`Failed to get resources for ${uuid}:`, error)
        return {
          uuid,
          name: server.name,
          status: 'unknown',
          error: 'Failed to fetch resources',
          limits: server.limits || {}
        }
      }
    })

    const serversWithResources = await Promise.all(resourcePromises)

    // Calculate total usage
    const totalUsed = {
      memory_mb: serversWithResources.reduce((sum, s) => sum + (s.resources?.memory_mb || 0), 0),
      memory_limit_mb: serversWithResources.reduce((sum, s) => sum + (s.limits?.memory || 0), 0),
      cpu_percent: serversWithResources.reduce((sum, s) => sum + (s.resources?.cpu_absolute || 0), 0),
      cpu_limit_percent: serversWithResources.reduce((sum, s) => sum + (s.limits?.cpu || 0), 0),
      disk_mb: serversWithResources.reduce((sum, s) => sum + (s.resources?.disk_mb || 0), 0),
      disk_limit_mb: serversWithResources.reduce((sum, s) => sum + (s.limits?.disk || 0), 0),
    }

    // Your SparkedHost Ultimate limits
    const planLimits = {
      memory_mb: 7168, // 7GB
      cpu_percent: 300, // 300%
      disk_mb: 102400 // 100GB
    }

    return NextResponse.json({
      servers: serversWithResources,
      totals: {
        used: totalUsed,
        plan_limits: planLimits,
        available: {
          memory_mb: planLimits.memory_mb - totalUsed.memory_limit_mb,
          cpu_percent: planLimits.cpu_percent - totalUsed.cpu_limit_percent,
          disk_mb: planLimits.disk_mb - totalUsed.disk_limit_mb,
        },
        utilization_percent: {
          memory: Math.round((totalUsed.memory_limit_mb / planLimits.memory_mb) * 100),
          cpu: Math.round((totalUsed.cpu_limit_percent / planLimits.cpu_percent) * 100),
          disk: Math.round((totalUsed.disk_limit_mb / planLimits.disk_mb) * 100),
        }
      }
    })

  } catch (error) {
    console.error('Error fetching resources:', error)
    return NextResponse.json({
      error: 'Failed to fetch resources',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}


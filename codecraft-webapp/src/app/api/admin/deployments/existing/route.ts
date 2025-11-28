import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPterodactylClient } from '@/lib/pterodactyl/client'

export const dynamic = 'force-dynamic'

// Get all existing servers from SparkedHost/Pterodactyl
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

    // Get all sub-servers from parent server
    const servers = await client.listSubServers()

    // Get all linked deployments from database
    const { supabaseAdmin } = await import('@/lib/supabase/server')
    const { data: deployments } = await supabaseAdmin
      .from('bot_deployments')
      .select('pterodactyl_server_id, server_uuid, order_id')

    // Mark which servers are already linked
    const linkedUuids = new Set(deployments?.map(d => d.server_uuid) || [])

    const serversWithStatus = servers.map((serverData: any) => {
      const server = serverData.attributes || serverData
      return {
        ...server,
        isLinked: linkedUuids.has(server.uuid || server.identifier),
        deployment: deployments?.find(
          d => d.server_uuid === (server.uuid || server.identifier)
        )
      }
    })

    return NextResponse.json({
      servers: serversWithStatus,
      total: servers.length,
      linked: Array.from(linkedUuids).length,
      unlinked: servers.length - linkedUuids.size
    })

  } catch (error) {
    console.error('Error fetching existing servers:', error)
    return NextResponse.json({
      error: 'Failed to fetch servers',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}


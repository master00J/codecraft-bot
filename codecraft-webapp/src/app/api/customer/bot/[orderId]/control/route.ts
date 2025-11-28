import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getPterodactylClient } from '@/lib/pterodactyl/client'

export const dynamic = 'force-dynamic'

// POST - Control bot (start/stop/restart)
export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // @ts-ignore
    const discordId = session.user.discordId

    const { action } = await request.json()

    if (!['start', 'stop', 'restart'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    const { data: deployment, error } = await supabaseAdmin
      .from('bot_deployments')
      .select('*, orders!inner(discord_id)')
      .eq('order_id', params.orderId)
      .single()

    if (error || !deployment || deployment.orders.discord_id !== discordId) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    if (!deployment.server_uuid) {
      return NextResponse.json(
        { error: 'Bot server not deployed yet' },
        { status: 400 }
      )
    }

    // Send power action to Pterodactyl
    const client = getPterodactylClient()
    
    try {
      await client.sendPowerAction(
        deployment.server_uuid, 
        action as 'start' | 'stop' | 'restart'
      )
      
      // Log the action
      await supabaseAdmin
        .from('deployment_logs')
        .insert({
          deployment_id: deployment.id,
          action: `customer_${action}`,
          status: 'success',
          details: {
            triggered_by: discordId
          }
        })

      return NextResponse.json({
        success: true,
        message: `Bot ${action} command sent successfully`
      })
    } catch (pterodactylError) {
      console.error('Pterodactyl error:', pterodactylError)
      return NextResponse.json({
        error: 'Failed to control bot',
        message: 'Server command failed'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error controlling bot:', error)
    return NextResponse.json({
      error: 'Failed to control bot'
    }, { status: 500 })
  }
}


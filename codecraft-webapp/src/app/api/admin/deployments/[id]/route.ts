import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { suspendBot, unsuspendBot, updateBotResources, terminateBot } from '@/lib/pterodactyl/provisioning'

export const dynamic = 'force-dynamic'

// Get single deployment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // @ts-ignore
    const isAdmin = session.user.isAdmin

    const { data: deployment, error } = await supabaseAdmin
      .from('bot_deployments')
      .select(`
        *,
        orders(
          id,
          service_type,
          tier,
          discord_guild_id,
          users(discord_tag, email, avatar_url)
        )
      `)
      .eq('id', id)
      .single()

    if (error || !deployment) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 })
    }

    // Check access (admin or owner)
    if (!isAdmin) {
      // @ts-ignore
      const customerDiscordId = session.user.discordId
      if (deployment.customer_discord_id !== customerDiscordId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Get deployment logs
    const { data: logs } = await supabaseAdmin
      .from('deployment_logs')
      .select('*')
      .eq('deployment_id', deployment.id)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      deployment,
      logs: logs || []
    })

  } catch (error) {
    console.error('Error fetching deployment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update deployment (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {

  const { id } = await params;

  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // @ts-ignore
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action, ...updateData } = body

    // Handle special actions
    if (action) {
      switch (action) {
        case 'suspend':
          const suspended = await suspendBot(id)
          return NextResponse.json({ success: suspended })

        case 'unsuspend':
          const unsuspended = await unsuspendBot(id)
          return NextResponse.json({ success: unsuspended })

        case 'terminate':
          const terminated = await terminateBot(id)
          return NextResponse.json({ success: terminated })

        case 'update_resources':
          if (!body.new_tier) {
            return NextResponse.json({ error: 'new_tier required' }, { status: 400 })
          }
          const updated = await updateBotResources(
            id,
            body.new_tier,
            body.new_addons || []
          )
          return NextResponse.json({ success: updated })

        default:
          return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
      }
    }

    // Regular update
    const { error } = await supabaseAdmin
      .from('bot_deployments')
      .update(updateData)
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error updating deployment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


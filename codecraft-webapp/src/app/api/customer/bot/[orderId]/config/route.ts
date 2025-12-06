import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getPterodactylClient } from '@/lib/pterodactyl/client'

export const dynamic = 'force-dynamic'

// GET - Get bot configuration
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
    const discordId = session.user.discordId

    const { data: deployment, error } = await supabaseAdmin
      .from('bot_deployments')
      .select('*, orders!inner(discord_id)')
      .eq('order_id', params.orderId)
      .single()

    if (error || !deployment || deployment.orders.discord_id !== discordId) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    // Get current config from Pterodactyl
    // For now, return mock config - can be extended with real Pterodactyl API calls
    const config = {
      status: deployment.status,
      features: {
        moderation: true,
        music: true,
        economy: false,
        custom_commands: true
      },
      // Don't send sensitive env vars to client
      hasDiscordToken: !!deployment.config?.DISCORD_TOKEN
    }

    return NextResponse.json({ config })

  } catch (error) {
    console.error('Error fetching config:', error)
    return NextResponse.json({
      error: 'Failed to fetch configuration'
    }, { status: 500 })
  }
}

// PATCH - Update bot configuration
export async function PATCH(
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
    const discordId = session.user.discordId

    const { data: deployment, error } = await supabaseAdmin
      .from('bot_deployments')
      .select('*, orders!inner(discord_id)')
      .eq('order_id', params.orderId)
      .single()

    if (error || !deployment || deployment.orders.discord_id !== discordId) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    const { features } = await request.json()

    // Update features in database
    await supabaseAdmin
      .from('bot_deployments')
      .update({
        config: {
          ...(deployment.config || {}),
          features
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', deployment.id)

    return NextResponse.json({
      success: true,
      message: 'Configuration updated'
    })

  } catch (error) {
    console.error('Error updating config:', error)
    return NextResponse.json({
      error: 'Failed to update configuration'
    }, { status: 500 })
  }
}


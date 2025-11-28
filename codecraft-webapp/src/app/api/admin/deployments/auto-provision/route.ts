import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { provisionBot } from '@/lib/pterodactyl/provisioning'

export const dynamic = 'force-dynamic'

// Auto-provision bot after payment verification
// Called by webhook or manually by admin
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Verify admin or webhook secret
    const webhookSecret = request.headers.get('x-webhook-secret')
    const isWebhook = webhookSecret === process.env.WEBHOOK_SECRET
    
    if (!isWebhook && !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isWebhook) {
      // @ts-ignore
      const isAdmin = session.user.isAdmin
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
      }
    }

    const body = await request.json()
    const { orderId, force = false } = body

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 }
      )
    }

    // Get order details
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey(discord_id, discord_tag)
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Check if already deployed
    const { data: existingDeployment } = await supabaseAdmin
      .from('bot_deployments')
      .select('id, status')
      .eq('order_id', orderId)
      .single()

    if (existingDeployment && !force) {
      return NextResponse.json({
        error: 'Order already has a deployment',
        deployment: existingDeployment
      }, { status: 400 })
    }

    // Verify payment is confirmed
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(1)

    if (!payments || payments.length === 0) {
      return NextResponse.json({
        error: 'No confirmed payment found for this order'
      }, { status: 400 })
    }

    // Check order status
    if (order.status !== 'quote_accepted' && order.status !== 'in_progress') {
      return NextResponse.json({
        error: `Order status must be 'quote_accepted', current: ${order.status}`
      }, { status: 400 })
    }

    // Validate required fields
    if (!order.discord_guild_id) {
      return NextResponse.json({
        error: 'Order missing discord_guild_id'
      }, { status: 400 })
    }

    // Get customer discord_id
    const customerDiscordId = order.users?.discord_id || order.discord_id

    if (!customerDiscordId) {
      return NextResponse.json({
        error: 'Cannot determine customer discord_id'
      }, { status: 400 })
    }

    // Parse selected addons
    let selectedAddons = []
    try {
      selectedAddons = typeof order.selected_addons === 'string' 
        ? JSON.parse(order.selected_addons)
        : order.selected_addons || []
    } catch (e) {
      console.warn('Failed to parse selected_addons:', e)
    }

    // Provision the bot!
    console.log('🚀 Auto-provisioning bot for order:', orderId)
    
    const result = await provisionBot({
      orderId: order.id,
      tier: order.tier || 'starter',
      discordGuildId: order.discord_guild_id,
      customerDiscordId,
      selectedAddons
    })

    if (!result.success) {
      return NextResponse.json({
        error: 'Provisioning failed',
        details: result.error
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Bot provisioned successfully',
      deployment: {
        id: result.deploymentId,
        serverId: result.serverId
      }
    })

  } catch (error) {
    console.error('Error in auto-provision:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Get orders ready for provisioning
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

    // Get orders that are paid but not deployed
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey(discord_id, discord_tag, avatar_url),
        bot_deployments(id, status)
      `)
      .in('status', ['quote_accepted', 'in_progress'])
      .is('bot_deployments.id', null)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    // Filter to only those with confirmed payment
    const readyOrders = []
    for (const order of orders || []) {
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('status')
        .eq('order_id', order.id)
        .eq('status', 'confirmed')
        .limit(1)
        .single()

      if (payment) {
        readyOrders.push(order)
      }
    }

    return NextResponse.json({
      orders: readyOrders,
      count: readyOrders.length
    })

  } catch (error) {
    console.error('Error fetching ready orders:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


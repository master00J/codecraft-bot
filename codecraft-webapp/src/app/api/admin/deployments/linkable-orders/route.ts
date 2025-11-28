import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Get all orders that can be linked to a server
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

    // Get all orders with verified payments
    // Include orders that:
    // 1. Have no deployment at all
    // 2. Have a deployment but no server_uuid (orphaned deployments)
    // 3. Include completed orders too (they might need linking!)
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_number,
        service_type,
        service_name,
        payment_status,
        status,
        discord_id,
        discord_guild_id,
        created_at
      `)
      .eq('payment_status', 'paid')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
    
    if (error) {
      throw error
    }

    // Manually fetch user data for each order
    const ordersWithUsers = await Promise.all(
      (orders || []).map(async (order) => {
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('discord_tag, avatar_url')
          .eq('discord_id', order.discord_id)
          .single()
        
        return {
          ...order,
          users: user
        }
      })
    )

    // Get all existing deployments
    const { data: deployments } = await supabaseAdmin
      .from('bot_deployments')
      .select('order_id, server_uuid, status')

    // Create a map of order_id -> deployment
    const deploymentMap = new Map(
      deployments?.map(d => [d.order_id, d]) || []
    )

    // Filter orders that can be linked:
    // - No deployment record, OR
    // - Deployment exists but has no server_uuid (orphaned)
    const linkableOrders = ordersWithUsers?.filter(order => {
      const deployment = deploymentMap.get(order.id)
      
      // Order has no deployment - can link
      if (!deployment) return true
      
      // Order has deployment but no server UUID - can link (will update)
      if (!deployment.server_uuid) return true
      
      // Order already has a server linked - cannot link again
      return false
    }) || []

    return NextResponse.json({
      orders: linkableOrders,
      total: linkableOrders.length
    })

  } catch (error) {
    console.error('Error fetching linkable orders:', error)
    return NextResponse.json({
      error: 'Failed to fetch orders',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}


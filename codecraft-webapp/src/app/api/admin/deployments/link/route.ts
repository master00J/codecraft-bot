import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Link an orphaned server to an order
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // @ts-ignore
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { serverUuid, orderId } = await request.json()

    if (!serverUuid || !orderId) {
      return NextResponse.json(
        { error: 'Server UUID and Order ID are required' },
        { status: 400 }
      )
    }

    // 1. Check if order exists
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, service_name, discord_id, discord_guild_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // 2. Check if this server is already linked
    const { data: existingLink } = await supabaseAdmin
      .from('bot_deployments')
      .select('id')
      .eq('server_uuid', serverUuid)
      .single()

    if (existingLink) {
      return NextResponse.json(
        { error: 'This server is already linked to an order' },
        { status: 400 }
      )
    }

    // 3. Check if order already has a deployment
    const { data: existingDeployment } = await supabaseAdmin
      .from('bot_deployments')
      .select('id, server_uuid')
      .eq('order_id', orderId)
      .single()

    if (existingDeployment) {
      // Update existing deployment with new server UUID
      const { error: updateError } = await supabaseAdmin
        .from('bot_deployments')
        .update({
          server_uuid: serverUuid,
          status: 'active',
          health_status: 'healthy',
          provisioned_at: new Date().toISOString()
        })
        .eq('id', existingDeployment.id)

      if (updateError) {
        throw updateError
      }

      // Log the linking action
      await supabaseAdmin
        .from('deployment_logs')
        .insert({
          deployment_id: existingDeployment.id,
          action: 'manual_link',
          status: 'success',
          details: {
            old_uuid: existingDeployment.server_uuid,
            new_uuid: serverUuid,
            linked_by: session.user.email
          }
        })

      return NextResponse.json({
        success: true,
        message: 'Server linked successfully (updated existing deployment)',
        deploymentId: existingDeployment.id
      })
    }

    // 4. Create new deployment record
    // Derive tier from service_name or use default
    let tier = 'starter'
    if (order.service_name) {
      const serviceLower = order.service_name.toLowerCase()
      if (serviceLower.includes('advanced') || serviceLower.includes('pro')) {
        tier = 'pro'
      } else if (serviceLower.includes('premium') || serviceLower.includes('business')) {
        tier = 'business'
      }
    }

    const { data: deployment, error: deployError } = await supabaseAdmin
      .from('bot_deployments')
      .insert({
        order_id: orderId,
        customer_discord_id: order.discord_id,
        discord_guild_id: order.discord_guild_id,
        tier: tier,
        server_uuid: serverUuid,
        status: 'active',
        health_status: 'healthy',
        provisioned_at: new Date().toISOString()
      })
      .select()
      .single()

    if (deployError) {
      throw deployError
    }

    // 5. Update order status
    await supabaseAdmin
      .from('orders')
      .update({
        status: 'in_progress',
        deployment_id: deployment.id
      })
      .eq('id', orderId)

    // 6. Log the linking action
    await supabaseAdmin
      .from('deployment_logs')
      .insert({
        deployment_id: deployment.id,
        action: 'manual_link',
        status: 'success',
        details: {
          server_uuid: serverUuid,
          order_id: orderId,
          linked_by: session.user.email
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Server linked successfully to order',
      deploymentId: deployment.id
    })

  } catch (error) {
    console.error('Error linking server:', error)
    return NextResponse.json({
      error: 'Failed to link server',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}


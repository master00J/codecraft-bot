import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Verify/Reject payment (admin only)
export async function POST(
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
    // @ts-ignore
    const discordId = session.user.discordId

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get admin user from database
    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('discord_id', discordId)
      .single()

    const paymentId = id
    const body = await request.json()
    const { action, notes } = body // action: 'confirm' or 'reject'

    if (!action || !['confirm', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Get payment with order info
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('*, orders(id, user_id)')
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Update payment
    const updateData: any = {
      status: action === 'confirm' ? 'confirmed' : 'rejected',
      verified_at: new Date().toISOString(),
      verified_by: adminUser?.id || null
    }

    if (notes) {
      updateData.notes = notes
    }

    const { error: updateError } = await supabaseAdmin
      .from('payments')
      .update(updateData)
      .eq('id', paymentId)

    if (updateError) {
      throw updateError
    }

    // If confirmed, update order payment status
    if (action === 'confirm') {
      await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'paid',
          status: 'in_progress'
        })
        .eq('id', payment.order_id)

      // Get order details for notifications
      const { data: orderData } = await supabaseAdmin
        .from('orders')
        .select('order_number, service_name, service_type, discord_id, price')
        .eq('id', payment.order_id)
        .single()

      // 📢 Send Discord notification
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
              type: 'payment.verified',
              discordId: orderData?.discord_id,
              data: {
                order_id: payment.order_id,
                order_number: orderData?.order_number,
                amount: payment.amount
              }
            })
          })
          console.log('📬 Discord notification sent for payment verification')
        }
      } catch (error) {
        console.warn('⚠️ Failed to send Discord notification:', error)
        // Don't fail if notification fails
      }

      // 🚀 Auto-provision bot in background
      try {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
        const provisionResponse = await fetch(`${baseUrl}/api/admin/deployments/auto-provision`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': process.env.WEBHOOK_SECRET || 'dev-secret'
          },
          body: JSON.stringify({
            orderId: payment.order_id
          })
        })

        if (provisionResponse.ok) {
          console.log('✅ Auto-provisioning triggered for order:', payment.order_id)
        } else {
          const errorText = await provisionResponse.text()
          console.warn('⚠️ Auto-provisioning failed:', errorText)
        }
      } catch (error) {
        console.error('❌ Failed to trigger auto-provisioning:', error)
        // Don't fail the payment verification if provisioning fails
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Payment ${action === 'confirm' ? 'confirmed' : 'rejected'} successfully`
    })

  } catch (error) {
    console.error('Error verifying payment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


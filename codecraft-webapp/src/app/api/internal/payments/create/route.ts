import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-internal-secret')

    if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      discordId,
      orderId,
      quoteId,
      paymentMethodId,
      amount,
      transactionId,
      notes
    } = body

    if (!discordId || !orderId || !paymentMethodId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, discord_id')
      .eq('discord_id', discordId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, order_number')
      .eq('id', orderId)
      .single()

    if (!order || order.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        order_id: orderId,
        quote_id: quoteId || null,
        payment_method_id: paymentMethodId,
        amount,
        transaction_id: transactionId || 'discord-confirmation',
        notes,
        status: 'pending'
      })
      .select()
      .single()

    if (paymentError) throw paymentError

    await supabaseAdmin
      .from('orders')
      .update({
        payment_status: 'pending',
        payment_method: paymentMethodId
      })
      .eq('id', orderId)

    return NextResponse.json({
      success: true,
      payment
    })

  } catch (error) {
    console.error('Internal payment create error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

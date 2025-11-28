import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Submit payment (customer)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // @ts-ignore
    const discordUserId = session.user.discordId

    const body = await request.json()
    const { order_id, quote_id, payment_method_id, amount, transaction_id, notes } = body

    if (!order_id || !payment_method_id || !amount || !transaction_id) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 })
    }

    // Verify order belongs to user
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('discord_id', discordUserId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('user_id')
      .eq('id', order_id)
      .single()

    if (!order || order.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        order_id,
        quote_id,
        payment_method_id,
        amount,
        transaction_id,
        notes,
        status: 'pending'
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Error creating payment:', paymentError)
      throw paymentError
    }

    // Update order payment status
    await supabaseAdmin
      .from('orders')
      .update({
        payment_status: 'pending',
        payment_method: payment_method_id
      })
      .eq('id', order_id)

    return NextResponse.json({ 
      payment,
      success: true,
      message: 'Payment submitted for verification' 
    })

  } catch (error) {
    console.error('Error submitting payment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


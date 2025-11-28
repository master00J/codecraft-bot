import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Send quote to customer (admin only)
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

    const body = await request.json()
    const { order_id, price, timeline, notes, payment_methods } = body

    // Create quote
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .insert({
        order_id,
        price,
        timeline,
        notes,
        payment_methods: payment_methods || [],
        status: 'pending',
        sent_at: new Date().toISOString()
      })
      .select()
      .single()

    if (quoteError) throw quoteError

    // Update order with quote info
    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .update({
        price,
        timeline,
        status: 'pending', // Keep as pending until quote is accepted
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)

    if (orderError) throw orderError

    console.log('Quote sent successfully:', quote.id)

    return NextResponse.json({ 
      quote, 
      success: true,
      message: 'Quote sent to customer' 
    })
  } catch (error) {
    console.error('Error sending quote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


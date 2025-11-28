import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

// Internal endpoint for Discord bot & other trusted services
// Requires X-Internal-Secret header matching INTERNAL_API_SECRET

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const secret = request.headers.get('x-internal-secret')

    if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orderId = params.id

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        users (
          discord_id,
          discord_tag,
          email,
          avatar_url
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const { data: quote } = await supabaseAdmin
      .from('quotes')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        payment_methods (
          name,
          type,
          address
        )
      `)
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      order,
      quote: quote || null,
      payments: payments || []
    })

  } catch (error) {
    console.error('Internal order fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

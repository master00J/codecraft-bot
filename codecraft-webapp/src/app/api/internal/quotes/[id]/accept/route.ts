import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {

  const { id } = await params;

  try {
    const secret = request.headers.get('x-internal-secret')

    if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const quoteId = id
    const body = await request.json()
    const { discordId } = body

    if (!quoteId || !discordId) {
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

    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .select('*, orders!inner(user_id)')
      .eq('id', quoteId)
      .single()

    if (quoteError || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (quote.orders.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (quote.status === 'accepted') {
      return NextResponse.json({ success: true, message: 'Quote already accepted' })
    }

    const { error: updateError } = await supabaseAdmin
      .from('quotes')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString()
      })
      .eq('id', quoteId)

    if (updateError) throw updateError

    await supabaseAdmin
      .from('orders')
      .update({
        status: 'in_progress',
        payment_status: 'pending'
      })
      .eq('id', quote.order_id)

    return NextResponse.json({
      success: true,
      message: 'Quote accepted successfully'
    })

  } catch (error) {
    console.error('Internal quote accept error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

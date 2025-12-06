import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Accept quote (customer only)
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
    const discordUserId = session.user.discordId

    const quoteId = params.id

    // Get quote with order info
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .select('*, orders!inner(user_id)')
      .eq('id', quoteId)
      .single()

    if (quoteError || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Verify quote belongs to user
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('discord_id', discordUserId)
      .single()

    if (!user || quote.orders.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Update quote status
    const { error: updateError } = await supabaseAdmin
      .from('quotes')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString()
      })
      .eq('id', quoteId)

    if (updateError) {
      throw updateError
    }

    // Update order status
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
    console.error('Error accepting quote:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


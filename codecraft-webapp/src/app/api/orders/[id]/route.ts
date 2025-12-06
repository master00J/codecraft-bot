import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Get single order for current user
export async function GET(
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

    // Get user from database
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('discord_id', discordUserId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const orderId = params.id

    // Get order (must belong to user)
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ 
        error: 'Order not found or access denied' 
      }, { status: 404 })
    }

    // Get associated quote if exists
    const { data: quote } = await supabaseAdmin
      .from('quotes')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Get payments if exist
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        payment_methods (
          name,
          type
        )
      `)
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })

    return NextResponse.json({ 
      order,
      quote: quote || null,
      payments: payments || [],
      success: true 
    })

  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


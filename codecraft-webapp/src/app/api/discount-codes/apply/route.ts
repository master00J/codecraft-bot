import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST - Apply discount code to order
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { discountCodeId, orderId, originalPrice, discountAmount, finalPrice } = await request.json()

    if (!discountCodeId || !orderId || !originalPrice || discountAmount === undefined || !finalPrice) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // @ts-ignore
    const discordId = session.user.discordId

    // Verify order belongs to user
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('discord_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order || order.discord_id !== discordId) {
      return NextResponse.json(
        { error: 'Order not found or unauthorized' },
        { status: 404 }
      )
    }

    // Record usage
    const { data: usage, error: usageError } = await supabaseAdmin
      .from('discount_code_usage')
      .insert({
        discount_code_id: discountCodeId,
        order_id: orderId,
        user_discord_id: discordId,
        discount_applied: discountAmount,
        original_price: originalPrice,
        final_price: finalPrice
      })
      .select()
      .single()

    if (usageError) {
      // Check if already used on this order
      if (usageError.code === '23505') {
        return NextResponse.json(
          { error: 'Discount code already applied to this order' },
          { status: 400 }
        )
      }
      throw usageError
    }

    return NextResponse.json({
      success: true,
      usage
    })

  } catch (error) {
    console.error('Error applying discount code:', error)
    return NextResponse.json({
      error: 'Failed to apply discount code',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}


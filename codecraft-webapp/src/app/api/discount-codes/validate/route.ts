import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST - Validate discount code
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { code, orderValue, tier } = await request.json()

    if (!code) {
      return NextResponse.json(
        { error: 'Discount code is required' },
        { status: 400 }
      )
    }

    // @ts-ignore
    const discordId = session.user.discordId

    // 1. Get discount code
    const { data: discountCode, error: codeError } = await supabaseAdmin
      .from('discount_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single()

    if (codeError || !discountCode) {
      return NextResponse.json(
        { 
          valid: false,
          error: 'Invalid discount code'
        },
        { status: 200 }
      )
    }

    // 2. Check validity period
    const now = new Date()
    if (discountCode.valid_from && new Date(discountCode.valid_from) > now) {
      return NextResponse.json({
        valid: false,
        error: 'This code is not yet active'
      }, { status: 200 })
    }

    if (discountCode.valid_until && new Date(discountCode.valid_until) < now) {
      return NextResponse.json({
        valid: false,
        error: 'This code has expired'
      }, { status: 200 })
    }

    // 3. Check max uses
    if (discountCode.max_uses && discountCode.current_uses >= discountCode.max_uses) {
      return NextResponse.json({
        valid: false,
        error: 'This code has reached its usage limit'
      }, { status: 200 })
    }

    // 4. Check user-specific usage
    const { count: userUsageCount } = await supabaseAdmin
      .from('discount_code_usage')
      .select('*', { count: 'exact', head: true })
      .eq('discount_code_id', discountCode.id)
      .eq('user_discord_id', discordId)

    if (discountCode.max_uses_per_user && userUsageCount && userUsageCount >= discountCode.max_uses_per_user) {
      return NextResponse.json({
        valid: false,
        error: 'You have already used this code'
      }, { status: 200 })
    }

    // 5. Check first-time only
    if (discountCode.first_time_only) {
      const { count: orderCount } = await supabaseAdmin
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('discord_id', discordId)

      if (orderCount && orderCount > 0) {
        return NextResponse.json({
          valid: false,
          error: 'This code is only for first-time customers'
        }, { status: 200 })
      }
    }

    // 6. Check minimum order value
    if (discountCode.min_order_value && orderValue && orderValue < discountCode.min_order_value) {
      return NextResponse.json({
        valid: false,
        error: `Minimum order value is €${discountCode.min_order_value}`
      }, { status: 200 })
    }

    // 7. Check applicable tiers
    if (discountCode.applicable_tiers && discountCode.applicable_tiers.length > 0) {
      if (!tier || !discountCode.applicable_tiers.includes(tier)) {
        return NextResponse.json({
          valid: false,
          error: `This code is only valid for ${discountCode.applicable_tiers.join(', ')} tiers`
        }, { status: 200 })
      }
    }

    // Calculate discount
    let discountAmount = 0
    if (discountCode.discount_type === 'percentage') {
      discountAmount = (orderValue * discountCode.discount_value) / 100
    } else {
      discountAmount = discountCode.discount_value
    }

    // Make sure discount doesn't exceed order value
    discountAmount = Math.min(discountAmount, orderValue)

    return NextResponse.json({
      valid: true,
      discount: {
        id: discountCode.id,
        code: discountCode.code,
        type: discountCode.discount_type,
        value: discountCode.discount_value,
        amount: discountAmount,
        finalPrice: orderValue - discountAmount
      }
    })

  } catch (error) {
    console.error('Error validating discount code:', error)
    return NextResponse.json({
      error: 'Failed to validate discount code',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}


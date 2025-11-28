import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET - List all discount codes
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // @ts-ignore
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: codes, error } = await supabaseAdmin
      .from('discount_codes')
      .select(`
        *,
        created_by_user:users!discount_codes_created_by_fkey (
          discord_tag
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get usage stats for each code
    const codesWithStats = await Promise.all(
      (codes || []).map(async (code) => {
        const { count } = await supabaseAdmin
          .from('discount_code_usage')
          .select('*', { count: 'exact', head: true })
          .eq('discount_code_id', code.id)

        return {
          ...code,
          usage_count: count || 0
        }
      })
    )

    return NextResponse.json({
      codes: codesWithStats,
      total: codesWithStats.length
    })

  } catch (error) {
    console.error('Error fetching discount codes:', error)
    return NextResponse.json({
      error: 'Failed to fetch discount codes',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST - Create new discount code
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
    const {
      code,
      description,
      discountType,
      discountValue,
      maxUses,
      maxUsesPerUser,
      minOrderValue,
      applicableTiers,
      firstTimeOnly,
      validFrom,
      validUntil
    } = body

    // Validation
    if (!code || !discountType || !discountValue) {
      return NextResponse.json(
        { error: 'Code, discount type, and value are required' },
        { status: 400 }
      )
    }

    if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
      return NextResponse.json(
        { error: 'Percentage discount must be between 0 and 100' },
        { status: 400 }
      )
    }

    // Get admin user ID
    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('id')
      // @ts-ignore
      .eq('discord_id', session.user.discordId)
      .single()

    const { data: newCode, error } = await supabaseAdmin
      .from('discount_codes')
      .insert({
        code: code.toUpperCase(),
        description,
        discount_type: discountType,
        discount_value: discountValue,
        max_uses: maxUses || null,
        max_uses_per_user: maxUsesPerUser || 1,
        min_order_value: minOrderValue || null,
        applicable_tiers: applicableTiers || null,
        first_time_only: firstTimeOnly || false,
        valid_from: validFrom || new Date().toISOString(),
        valid_until: validUntil || null,
        created_by: adminUser?.id || null,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This discount code already exists' },
          { status: 400 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      code: newCode
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating discount code:', error)
    return NextResponse.json({
      error: 'Failed to create discount code',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}


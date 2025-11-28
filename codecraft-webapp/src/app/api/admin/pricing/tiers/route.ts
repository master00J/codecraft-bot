import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Create pricing tier (admin only)
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
    const { category_id, name, price, timeline, features, is_popular, display_order } = body

    const { data: tier, error } = await supabaseAdmin
      .from('pricing_tiers')
      .insert({
        category_id,
        name,
        price,
        timeline,
        features: features || [],
        is_popular: is_popular ?? false,
        display_order: display_order ?? 0,
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ tier, success: true })
  } catch (error) {
    console.error('Error creating tier:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Get all add-ons (admin)
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

    const { data: addons, error } = await supabaseAdmin
      .from('pricing_addons')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({ addons: addons || [], success: true })
  } catch (error) {
    console.error('Error fetching addons:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create add-on (admin only)
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
    const { name, description, price, billing_type, billing_interval, icon, restrictions } = body

    const { data: addon, error } = await supabaseAdmin
      .from('pricing_addons')
      .insert({
        name,
        description,
        price,
        billing_type: billing_type || 'monthly',
        billing_interval: billing_interval || 'month',
        icon,
        restrictions: restrictions || [],
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ addon, success: true })
  } catch (error) {
    console.error('Error creating addon:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


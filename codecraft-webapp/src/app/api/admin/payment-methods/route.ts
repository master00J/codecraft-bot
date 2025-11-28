import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Get all payment methods (admin only)
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

    const { data: methods, error } = await supabaseAdmin
      .from('payment_methods')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({ methods: methods || [], success: true })
  } catch (error) {
    console.error('Error fetching payment methods:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create payment method (admin only)
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
    const { name, type, address, instructions, is_active, display_order } = body

    const { data: method, error } = await supabaseAdmin
      .from('payment_methods')
      .insert({
        name,
        type,
        address,
        instructions,
        is_active: is_active ?? true,
        display_order: display_order ?? 0
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ method, success: true })
  } catch (error) {
    console.error('Error creating payment method:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


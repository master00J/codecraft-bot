import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const secret = request.headers.get('x-internal-secret')

    if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const discordId = searchParams.get('discordId')

    if (!discordId) {
      return NextResponse.json({ error: 'discordId is required' }, { status: 400 })
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('discord_id', discordId)
      .single()

    if (!user) {
      return NextResponse.json({ success: true, orders: [] })
    }

    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ success: true, orders: orders || [] })

  } catch (error) {
    console.error('Internal orders by user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

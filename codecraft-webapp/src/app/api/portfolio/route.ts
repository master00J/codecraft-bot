import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Get all portfolio items (public)
export async function GET(request: NextRequest) {
  try {
    const { data: items, error } = await supabaseAdmin
      .from('portfolio')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching portfolio:', error)
      throw error
    }

    return NextResponse.json({ 
      items: items || [],
      success: true 
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', items: [] },
      { status: 500 }
    )
  }
}


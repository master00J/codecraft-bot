import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Get active payment methods (public)
export async function GET(request: NextRequest) {
  try {
    const { data: methods, error } = await supabaseAdmin
      .from('payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching payment methods:', error)
      throw error
    }

    return NextResponse.json({ 
      methods: methods || [],
      success: true 
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', methods: [] },
      { status: 500 }
    )
  }
}


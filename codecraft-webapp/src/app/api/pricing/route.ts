import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Get all pricing (public)
export async function GET(request: NextRequest) {
  try {
    // Get active categories with their tiers
    const { data: categories, error: catError } = await supabaseAdmin
      .from('service_categories')
      .select(`
        *,
        pricing_tiers (*)
      `)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (catError) throw catError

    // Get active add-ons
    const { data: addons, error: addonsError } = await supabaseAdmin
      .from('pricing_addons')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (addonsError) throw addonsError

    // Sort tiers within each category
    const categoriesWithSortedTiers = categories?.map(cat => ({
      ...cat,
      pricing_tiers: cat.pricing_tiers
        ?.filter((t: any) => t.is_active)
        .sort((a: any, b: any) => a.display_order - b.display_order) || []
    }))

    return NextResponse.json({ 
      categories: categoriesWithSortedTiers || [],
      addons: addons || [],
      success: true 
    })
  } catch (error) {
    console.error('Error fetching pricing:', error)
    return NextResponse.json(
      { error: 'Internal server error', categories: [], addons: [] },
      { status: 500 }
    )
  }
}


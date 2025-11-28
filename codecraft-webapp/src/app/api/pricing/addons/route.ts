import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Get all active add-ons (public)
// Optional tier_id query param to filter by tier
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tierId = searchParams.get('tier_id')

    // If tier_id provided, get only allowed add-ons for that tier
    if (tierId) {
      const { data: links, error: linksError } = await supabaseAdmin
        .from('tier_allowed_addons')
        .select('addon_id')
        .eq('tier_id', tierId)

      if (linksError) throw linksError

      const allowedAddonIds = links?.map(l => l.addon_id) || []

      // If no specific add-ons configured, return all active add-ons
      if (allowedAddonIds.length === 0) {
        const { data: allAddons, error: allError } = await supabaseAdmin
          .from('pricing_addons')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true })

        if (allError) throw allError

        return NextResponse.json({ 
          addons: allAddons || [],
          success: true 
        })
      }

      // Get only allowed add-ons
      const { data: addons, error: addonsError } = await supabaseAdmin
        .from('pricing_addons')
        .select('*')
        .in('id', allowedAddonIds)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (addonsError) throw addonsError

      return NextResponse.json({ 
        addons: addons || [],
        success: true 
      })
    }

    // No tier specified, return all active add-ons
    const { data: addons, error } = await supabaseAdmin
      .from('pricing_addons')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({ 
      addons: addons || [],
      success: true 
    })
  } catch (error) {
    console.error('Error fetching addons:', error)
    return NextResponse.json(
      { error: 'Internal server error', addons: [] },
      { status: 500 }
    )
  }
}


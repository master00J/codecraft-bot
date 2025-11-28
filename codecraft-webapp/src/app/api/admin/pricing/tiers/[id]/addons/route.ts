import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Get allowed add-ons for a tier
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // @ts-ignore
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: links, error } = await supabaseAdmin
      .from('tier_allowed_addons')
      .select('addon_id')
      .eq('tier_id', params.id)

    if (error) throw error

    const addonIds = links?.map(l => l.addon_id) || []

    return NextResponse.json({ addon_ids: addonIds, success: true })
  } catch (error) {
    console.error('Error fetching tier addons:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Set allowed add-ons for a tier
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { addon_ids } = body // Array of addon IDs

    const tierId = params.id

    // Delete existing links
    await supabaseAdmin
      .from('tier_allowed_addons')
      .delete()
      .eq('tier_id', tierId)

    // Insert new links
    if (addon_ids && addon_ids.length > 0) {
      const links = addon_ids.map((addonId: string) => ({
        tier_id: tierId,
        addon_id: addonId
      }))

      const { error } = await supabaseAdmin
        .from('tier_allowed_addons')
        .insert(links)

      if (error) throw error
    }

    return NextResponse.json({ 
      success: true,
      message: 'Add-ons updated for tier' 
    })
  } catch (error) {
    console.error('Error updating tier addons:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


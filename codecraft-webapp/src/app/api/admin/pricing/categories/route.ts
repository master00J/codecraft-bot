import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Get all categories (admin)
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

    const { data: categories, error } = await supabaseAdmin
      .from('service_categories')
      .select(`
        *,
        pricing_tiers (*)
      `)
      .order('display_order', { ascending: true })

    if (error) throw error

    // Sort tiers
    const categoriesWithSortedTiers = categories?.map(cat => ({
      ...cat,
      pricing_tiers: cat.pricing_tiers?.sort((a: any, b: any) => a.display_order - b.display_order) || []
    }))

    return NextResponse.json({ categories: categoriesWithSortedTiers || [], success: true })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create category (admin only)
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
    const { name, description, icon, display_order } = body

    const { data: category, error } = await supabaseAdmin
      .from('service_categories')
      .insert({
        name,
        description,
        icon,
        display_order: display_order ?? 0,
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ category, success: true })
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


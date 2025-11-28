import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Get all portfolio items (admin)
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

    const { data: items, error } = await supabaseAdmin
      .from('portfolio')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ items: items || [], success: true })
  } catch (error) {
    console.error('Error fetching portfolio:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create portfolio item (admin only)
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
    const { 
      title, 
      category, 
      client, 
      description, 
      technologies, 
      features, 
      results, 
      timeline, 
      budget, 
      image_url,
      is_featured,
      display_order 
    } = body

    const { data: item, error } = await supabaseAdmin
      .from('portfolio')
      .insert({
        title,
        category,
        client,
        description,
        technologies: technologies || [],
        features: features || [],
        results,
        timeline,
        budget,
        image_url,
        is_featured: is_featured ?? false,
        display_order: display_order ?? 0
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ item, success: true })
  } catch (error) {
    console.error('Error creating portfolio item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


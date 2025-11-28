import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/suggestions
 * Submit a new suggestion/feedback
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { title, description, category, guild_id } = body

    // Validation
    if (!title || !description || !category) {
      return NextResponse.json(
        { error: 'Title, description, and category are required' },
        { status: 400 }
      )
    }

    // Create suggestion in Supabase
    const { data: suggestion, error } = await supabaseAdmin
      .from('suggestions')
      .insert({
        user_id: token.id as string,
        discord_id: token.discordId as string,
        discord_tag: token.discordTag as string,
        guild_id: guild_id || null,
        title: title.trim(),
        description: description.trim(),
        category,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating suggestion:', error)
      return NextResponse.json(
        { error: 'Failed to create suggestion' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      suggestion,
    })
  } catch (error) {
    console.error('Error in POST /api/suggestions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/suggestions
 * Get all suggestions (admin only) or user's own suggestions
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const isAdmin = token.isAdmin === true
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    let query = supabaseAdmin
      .from('suggestions')
      .select('*')
      .order('created_at', { ascending: false })

    // Non-admin users can only see their own suggestions
    if (!isAdmin) {
      query = query.eq('user_id', token.id as string)
    }

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: suggestions, error } = await query

    if (error) {
      console.error('Error fetching suggestions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch suggestions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      suggestions,
      isAdmin,
    })
  } catch (error) {
    console.error('Error in GET /api/suggestions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


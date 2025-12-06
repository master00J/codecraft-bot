import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/suggestions/[id]
 * Update a suggestion (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {

  const { id } = await params;

  try {
    // Check authentication
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token || !token.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { status, priority, admin_notes } = body

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString(),
    }

    if (status) {
      updates.status = status
    }

    if (priority !== undefined) {
      updates.priority = priority
    }

    if (admin_notes !== undefined) {
      updates.admin_notes = admin_notes
    }

    // Update suggestion in Supabase
    const { data: suggestion, error } = await supabaseAdmin
      .from('suggestions')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating suggestion:', error)
      return NextResponse.json(
        { error: 'Failed to update suggestion' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      suggestion,
    })
  } catch (error) {
    console.error('Error in PATCH /api/suggestions/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/suggestions/[id]
 * Delete a suggestion (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {

  const { id } = await params;

  try {
    // Check authentication
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token || !token.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      )
    }

    // Delete suggestion from Supabase
    const { error } = await supabaseAdmin
      .from('suggestions')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting suggestion:', error)
      return NextResponse.json(
        { error: 'Failed to delete suggestion' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error in DELETE /api/suggestions/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


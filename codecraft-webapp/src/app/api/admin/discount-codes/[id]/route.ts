import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET - Get specific discount code
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

    const { data: code, error } = await supabaseAdmin
      .from('discount_codes')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) throw error

    if (!code) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 })
    }

    return NextResponse.json({ code })

  } catch (error) {
    console.error('Error fetching discount code:', error)
    return NextResponse.json({
      error: 'Failed to fetch discount code',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PATCH - Update discount code
export async function PATCH(
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

    const { data: updated, error } = await supabaseAdmin
      .from('discount_codes')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      code: updated
    })

  } catch (error) {
    console.error('Error updating discount code:', error)
    return NextResponse.json({
      error: 'Failed to update discount code',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE - Delete discount code
export async function DELETE(
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

    // Check if code has been used
    const { count } = await supabaseAdmin
      .from('discount_code_usage')
      .select('*', { count: 'exact', head: true })
      .eq('discount_code_id', params.id)

    if (count && count > 0) {
      // Soft delete - just deactivate
      await supabaseAdmin
        .from('discount_codes')
        .update({ is_active: false })
        .eq('id', params.id)

      return NextResponse.json({
        success: true,
        message: 'Discount code deactivated (has usage history)'
      })
    }

    // Hard delete if never used
    const { error } = await supabaseAdmin
      .from('discount_codes')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Discount code deleted'
    })

  } catch (error) {
    console.error('Error deleting discount code:', error)
    return NextResponse.json({
      error: 'Failed to delete discount code',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}


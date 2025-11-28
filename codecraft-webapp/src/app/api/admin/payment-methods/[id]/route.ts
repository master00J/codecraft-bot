import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Update payment method (admin only)
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
    const { is_active, name, address, instructions } = body

    const updateData: any = { updated_at: new Date().toISOString() }
    if (is_active !== undefined) updateData.is_active = is_active
    if (name) updateData.name = name
    if (address) updateData.address = address
    if (instructions !== undefined) updateData.instructions = instructions

    const { data: method, error } = await supabaseAdmin
      .from('payment_methods')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ method, success: true })
  } catch (error) {
    console.error('Error updating payment method:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Delete payment method (admin only)
// Actually performs a "soft delete" by setting is_active to false
// This preserves data integrity for existing payments
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

    // Check if payment method is being used by any payments
    const { data: payments, error: checkError } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('payment_method_id', params.id)
      .limit(1)

    if (checkError) {
      console.error('Error checking payments:', checkError)
      throw checkError
    }

    // If payment method is in use, soft delete (set is_active = false)
    // Otherwise, we can safely hard delete
    if (payments && payments.length > 0) {
      const { error } = await supabaseAdmin
        .from('payment_methods')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)

      if (error) throw error

      return NextResponse.json({ 
        success: true, 
        softDeleted: true,
        message: 'Payment method deactivated (in use by existing payments)'
      })
    } else {
      // No payments using this method, safe to hard delete
      const { error } = await supabaseAdmin
        .from('payment_methods')
        .delete()
        .eq('id', params.id)

      if (error) throw error

      return NextResponse.json({ 
        success: true, 
        softDeleted: false,
        message: 'Payment method deleted'
      })
    }
  } catch (error) {
    console.error('Error deleting payment method:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}


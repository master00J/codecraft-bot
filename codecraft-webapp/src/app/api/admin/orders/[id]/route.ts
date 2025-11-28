import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Get single order by ID (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get user from NextAuth session
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized - Not logged in' }, { status: 401 })
    }

    // @ts-ignore
    const isAdmin = session.user.isAdmin

    // Check if user is admin
    if (!isAdmin) {
      return NextResponse.json({ 
        error: 'Forbidden - Admin access required'
      }, { status: 403 })
    }

    const orderId = params.id

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 })
    }

    console.log('Fetching order:', orderId)

    // Get order from Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .select(`
          *,
          users (
            discord_id,
            discord_tag,
            email,
            avatar_url
          )
        `)
        .eq('id', orderId)
        .single()

      if (error) {
        console.error('Supabase error:', error)
        if (error.code === 'PGRST116') {
          return NextResponse.json({ 
            error: 'Order not found',
            message: 'No order exists with this ID'
          }, { status: 404 })
        }
        throw error
      }

      // Get quote if exists
      const { data: quote } = await supabaseAdmin
        .from('quotes')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Get payments if exist
      const { data: payments } = await supabaseAdmin
        .from('payments')
        .select(`
          *,
          payment_methods (
            name,
            type,
            address
          )
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })

      console.log('Order found:', order.order_number)

      return NextResponse.json({ 
        order,
        quote: quote || null,
        payments: payments || [],
        success: true 
      })
    }

    return NextResponse.json({ 
      error: 'Database not configured'
    }, { status: 500 })

  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        success: false 
      },
      { status: 500 }
    )
  }
}

// Update order (admin only)
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
    const isAdmin = session.user.isAdmin

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orderId = params.id
    const body = await request.json()

    console.log('Updating order:', orderId, body)

    // Update order in Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const updateData: any = {
        updated_at: new Date().toISOString()
      }

      // Only update allowed fields
      if (body.status) updateData.status = body.status
      if (body.price !== undefined) updateData.price = body.price
      if (body.payment_status) updateData.payment_status = body.payment_status
      if (body.timeline) updateData.timeline = body.timeline
      if (body.completed_at !== undefined) updateData.completed_at = body.completed_at
      
      // Auto-set completed_at when status changes to completed
      if (body.status === 'completed' && !body.completed_at) {
        updateData.completed_at = new Date().toISOString()
      }

      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      console.log('Order updated successfully')

      return NextResponse.json({ 
        order,
        success: true 
      })
    }

    return NextResponse.json({ 
      error: 'Database not configured'
    }, { status: 500 })

  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Get all users with their order counts (admin only)
export async function GET(request: NextRequest) {
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

    console.log('Fetching all users for admin...')

    // Get all users from Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        // Get all users
        const { data: users, error: usersError } = await supabaseAdmin
          .from('users')
          .select('*')
          .order('created_at', { ascending: false })

        if (usersError) {
          console.error('Supabase error:', usersError)
          throw usersError
        }

        // Get order counts for each user
        const usersWithStats = await Promise.all(
          (users || []).map(async (user) => {
            // Get order count
            const { count: orderCount, error: countError } = await supabaseAdmin
              .from('orders')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)

            // Get total spent
            const { data: orders, error: ordersError } = await supabaseAdmin
              .from('orders')
              .select('price')
              .eq('user_id', user.id)
              .not('price', 'is', null)

            const totalSpent = orders?.reduce((sum, order) => sum + (order.price || 0), 0) || 0

            // Get last order date
            const { data: lastOrder } = await supabaseAdmin
              .from('orders')
              .select('created_at')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single()

            return {
              ...user,
              order_count: orderCount || 0,
              total_spent: totalSpent,
              last_order_at: lastOrder?.created_at || null
            }
          })
        )

        console.log(`Found ${usersWithStats.length} users`)

        return NextResponse.json({ 
          users: usersWithStats,
          success: true 
        })
      } catch (supabaseError) {
        console.error('Error fetching from Supabase:', supabaseError)
        return NextResponse.json({ 
          users: [],
          success: false,
          error: 'Database error'
        })
      }
    }

    return NextResponse.json({ 
      users: [],
      success: false,
      message: 'Database not configured'
    })

  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        users: [],
        success: false 
      },
      { status: 500 }
    )
  }
}


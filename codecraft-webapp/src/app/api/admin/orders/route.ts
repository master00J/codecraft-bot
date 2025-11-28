import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Get all orders (admin only)
export async function GET(request: NextRequest) {
  try {
    // Get user from NextAuth session
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized - Not logged in' }, { status: 401 })
    }

    // @ts-ignore
    const discordUserId = session.user.discordId
    // @ts-ignore
    const isAdmin = session.user.isAdmin

    console.log('Checking admin status:', { discordUserId, isAdmin })

    // Check if user is admin
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Admin status is already in session from JWT callback
      if (!isAdmin) {
        console.log('User is not admin')
        return NextResponse.json({ 
          error: 'Forbidden - Admin access required',
          message: 'You need to be an admin to access this resource'
        }, { status: 403 })
      }

      console.log('Admin access granted')
    } else {
      // If Supabase not configured, allow access (development mode)
      console.warn('Supabase not configured - allowing admin access in dev mode')
    }

    console.log('Fetching all orders for admin...')

    // Get all orders from Supabase (if configured)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { data: orders, error } = await supabaseAdmin
          .from('orders')
          .select(`
            *,
            users (
              discord_tag,
              email,
              avatar_url
            )
          `)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Supabase error:', error)
          throw error
        }

        console.log(`Found ${orders?.length || 0} orders`)

        return NextResponse.json({ 
          orders: orders || [],
          success: true 
        })
      } catch (supabaseError) {
        console.error('Error fetching from Supabase:', supabaseError)
        // Return empty array if Supabase fails
        return NextResponse.json({ 
          orders: [],
          success: false,
          error: 'Database error',
          message: 'Could not fetch orders from database'
        })
      }
    }

    // If Supabase not configured, return empty array
    return NextResponse.json({ 
      orders: [],
      success: false,
      message: 'Database not configured'
    })

  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        orders: [],
        success: false 
      },
      { status: 500 }
    )
  }
}


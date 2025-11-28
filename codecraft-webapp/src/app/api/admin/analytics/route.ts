import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { Order, User } from '@/types/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Get analytics data (admin only)
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

    console.log('Fetching analytics data...')

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        // Get all orders
        const { data: orders, error: ordersError } = await supabaseAdmin
          .from('orders')
          .select('*')
          .order('created_at', { ascending: true })
          .returns<Order[]>()

        if (ordersError) throw ordersError

        // Get all users
        const { data: users, error: usersError } = await supabaseAdmin
          .from('users')
          .select('created_at')
          .order('created_at', { ascending: true })
          .returns<Pick<User, 'created_at'>[]>()

        if (usersError) throw usersError

        // Calculate revenue by month
        const revenueByMonth: { [key: string]: number } = {}
        const ordersByMonth: { [key: string]: number } = {}
        
        orders?.forEach(order => {
          if (order.price && (order.status === 'completed' || order.status === 'in_progress')) {
            const date = new Date(order.created_at)
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + order.price
            ordersByMonth[monthKey] = (ordersByMonth[monthKey] || 0) + 1
          }
        })

        // Format revenue data for charts
        const revenueData = Object.entries(revenueByMonth)
          .map(([month, revenue]) => ({
            month,
            revenue,
            orders: ordersByMonth[month] || 0
          }))
          .sort((a, b) => a.month.localeCompare(b.month))

        // Calculate service type distribution
        const serviceStats: { [key: string]: { count: number; revenue: number } } = {}
        orders?.forEach(order => {
          const service = order.service_type || 'Unknown'
          if (!serviceStats[service]) {
            serviceStats[service] = { count: 0, revenue: 0 }
          }
          serviceStats[service].count++
          if (order.price) {
            serviceStats[service].revenue += order.price
          }
        })

        const serviceData = Object.entries(serviceStats).map(([name, stats]) => ({
          name,
          count: stats.count,
          revenue: stats.revenue
        }))

        // Calculate customer growth by month
        const customersByMonth: { [key: string]: number } = {}
        users?.forEach(user => {
          const date = new Date(user.created_at)
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          customersByMonth[monthKey] = (customersByMonth[monthKey] || 0) + 1
        })

        const customerGrowthData = Object.entries(customersByMonth)
          .map(([month, count]) => ({
            month,
            customers: count
          }))
          .sort((a, b) => a.month.localeCompare(b.month))

        // Add cumulative count
        let cumulative = 0
        const customerGrowthWithCumulative = customerGrowthData.map(item => {
          cumulative += item.customers
          return {
            ...item,
            total: cumulative
          }
        })

        // Calculate status distribution
        const statusStats = {
          pending: orders?.filter(o => o.status === 'pending').length || 0,
          in_progress: orders?.filter(o => o.status === 'in_progress').length || 0,
          completed: orders?.filter(o => o.status === 'completed').length || 0,
          cancelled: orders?.filter(o => o.status === 'cancelled').length || 0
        }

        // Calculate payment stats
        const paymentStats = {
          paid: orders?.filter(o => o.payment_status === 'paid').length || 0,
          pending: orders?.filter(o => o.payment_status === 'pending').length || 0,
          refunded: orders?.filter(o => o.payment_status === 'refunded').length || 0
        }

        // Calculate totals
        const totalRevenue = orders?.reduce((sum, o) => {
          if (o.price && (o.status === 'completed' || o.status === 'in_progress')) {
            return sum + o.price
          }
          return sum
        }, 0) || 0

        const avgOrderValue = orders && orders.length > 0 
          ? totalRevenue / orders.length 
          : 0

        console.log('Analytics data compiled successfully')

        return NextResponse.json({ 
          revenueByMonth: revenueData,
          serviceDistribution: serviceData,
          customerGrowth: customerGrowthWithCumulative,
          statusDistribution: statusStats,
          paymentDistribution: paymentStats,
          totals: {
            totalRevenue,
            totalOrders: orders?.length || 0,
            totalCustomers: users?.length || 0,
            avgOrderValue: Math.round(avgOrderValue)
          },
          success: true 
        })
      } catch (supabaseError) {
        console.error('Error fetching analytics:', supabaseError)
        return NextResponse.json({ 
          error: 'Database error',
          success: false
        }, { status: 500 })
      }
    }

    return NextResponse.json({ 
      error: 'Database not configured',
      success: false
    }, { status: 500 })

  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        success: false 
      },
      { status: 500 }
    )
  }
}


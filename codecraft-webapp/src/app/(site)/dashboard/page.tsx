"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingBag, MessageSquare, Clock, CheckCircle, ArrowRight, Loader2 } from "lucide-react"
import { Link } from '@/navigation'
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface Order {
  id: string
  order_number: string
  service_type: string
  service_name?: string
  status: string
  price?: number
  created_at: string
}

interface Stats {
  totalOrders: number
  activeOrders: number
  completedOrders: number
  totalSpent: number
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    totalSpent: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/dashboard')
    }
    
    if (status === 'authenticated') {
      fetchDashboardData()
    }
  }, [status, router])

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/orders')
      const data = await response.json()
      
      if (response.ok && data.orders) {
        const allOrders = data.orders
        setOrders(allOrders)
        
        // Calculate stats
        const activeCount = allOrders.filter((o: Order) => 
          ['pending', 'quote_sent', 'in_progress'].includes(o.status)
        ).length
        
        const completedCount = allOrders.filter((o: Order) => 
          o.status === 'completed'
        ).length
        
        const totalSpent = allOrders
          .filter((o: Order) => o.price)
          .reduce((sum: number, o: Order) => sum + (o.price || 0), 0)
        
        setStats({
          totalOrders: allOrders.length,
          activeOrders: activeCount,
          completedOrders: completedCount,
          totalSpent: totalSpent
        })
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null // Will redirect
  }

  const recentOrders = orders.slice(0, 3)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome back!</h1>
        <p className="text-muted-foreground">
          Here's an overview of your projects and activity
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Orders
                </CardTitle>
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalOrders}</div>
                <p className="text-xs text-muted-foreground">
                  All time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Orders
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeOrders}</div>
                <p className="text-xs text-muted-foreground">
                  In progress
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Completed Orders
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.completedOrders}</div>
                <p className="text-xs text-muted-foreground">
                  All done
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Spent
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">€{stats.totalSpent}</div>
                <p className="text-xs text-muted-foreground">
                  All projects
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Recent Orders */}
      {!loading && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>
                  Your latest project orders
                </CardDescription>
              </div>
              <Link href="/dashboard/orders">
                <Button variant="outline" size="sm" className="gap-2">
                  View All <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No orders yet</p>
                <Link href="/pricing">
                  <Button className="mt-4">Place Your First Order</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <Link 
                    key={order.id} 
                    href={`/dashboard/orders/${order.id}`}
                    className="block hover:bg-muted/50 rounded-lg p-3 -m-3 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{order.order_number}</p>
                          <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                            {order.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {order.service_name || order.service_type}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {order.price ? `€${order.price}` : 'Pending'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Start a new project or get support
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Link href="/pricing">
            <Button className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              New Order
            </Button>
          </Link>
          <Link href="/contact">
            <Button variant="outline" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Contact Support
            </Button>
          </Link>
          <Link href="/portfolio">
            <Button variant="outline">
              View Portfolio
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

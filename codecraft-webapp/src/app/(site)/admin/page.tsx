"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DollarSign, ShoppingBag, Users, TrendingUp, Clock, CheckCircle, RefreshCw, Brain, Zap } from "lucide-react"
import { Link } from '@/navigation'

interface Order {
  id: string
  order_number: string
  service_type: string
  status: string
  price?: number
  created_at: string
  users?: {
    discord_tag: string
  }
}

interface Stats {
  totalRevenue: number
  totalOrders: number
  activeOrders: number
  completedOrders: number
  totalCustomers: number
  avgOrderValue: number
}

interface AiStats {
  totalTokens: number
  totalCost: number
  totalRequests: number
  activeServers: number
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    totalCustomers: 0,
    avgOrderValue: 0
  })
  const [aiStats, setAiStats] = useState<AiStats>({
    totalTokens: 0,
    totalCost: 0,
    totalRequests: 0,
    activeServers: 0
  })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchDashboardData = async () => {
    setIsLoading(true)
    try {
      // Fetch orders
      const response = await fetch('/api/admin/orders')
      const data = await response.json()

      // Fetch AI usage
      const aiResponse = await fetch('/api/admin/ai-usage?period=month&limit=1')
      const aiData = await aiResponse.json()
      
      if (aiResponse.ok && aiData.totals) {
        setAiStats({
          totalTokens: aiData.totals.totalTokens || 0,
          totalCost: aiData.totals.totalCost || 0,
          totalRequests: aiData.totals.totalRequests || 0,
          activeServers: aiData.totals.totalGuilds || 0
        })
      }

      if (response.ok && data.orders) {
        const orders = data.orders as Order[]
        
        // Calculate stats
        const totalRevenue = orders
          .filter(o => o.price && (o.status === 'completed' || o.status === 'in_progress'))
          .reduce((sum, o) => sum + (o.price || 0), 0)
        
        const activeOrders = orders.filter(o => o.status === 'in_progress').length
        const completedOrders = orders.filter(o => o.status === 'completed').length
        
        // Get unique customers
        const uniqueCustomers = new Set(orders.map(o => o.users?.discord_tag).filter(Boolean))
        
        const avgOrderValue = totalRevenue > 0 && orders.length > 0 
          ? Math.round(totalRevenue / orders.length) 
          : 0

        setStats({
          totalRevenue,
          totalOrders: orders.length,
          activeOrders,
          completedOrders,
          totalCustomers: uniqueCustomers.size,
          avgOrderValue
        })

        // Get 5 most recent orders
        setRecentOrders(orders.slice(0, 5))
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Overview</h1>
          <p className="text-muted-foreground">
            Business metrics and recent activity
          </p>
        </div>
        <Button onClick={fetchDashboardData} disabled={isLoading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              From {stats.completedOrders} completed orders
            </p>
          </CardContent>
        </Card>

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
              All time orders
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
              Currently in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Customers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              Unique customers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Usage Stats (This Month) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              AI Usage (This Month)
            </h2>
            <p className="text-sm text-muted-foreground">
              Token usage across all Comcraft servers
            </p>
          </div>
          <Link href="/admin/ai-usage">
            <Button variant="outline" size="sm">View Details</Button>
          </Link>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Tokens
              </CardTitle>
              <Zap className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {aiStats.totalTokens.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Input + Output tokens
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Cost
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${aiStats.totalCost.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                API costs this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Requests
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {aiStats.totalRequests.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                AI API calls
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Servers
              </CardTitle>
              <Users className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {aiStats.activeServers}
              </div>
              <p className="text-xs text-muted-foreground">
                Using AI features
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>
              Latest customer orders and their status
            </CardDescription>
          </div>
          <Link href="/admin/orders">
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No orders yet</p>
              <p className="text-sm">Orders will appear here when customers submit them</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <Link key={order.id} href={`/admin/orders/${order.id}`}>
                  <div className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 hover:bg-muted/50 -mx-4 px-4 py-2 rounded-lg transition-colors cursor-pointer">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{order.order_number}</p>
                        <Badge variant={
                          order.status === 'completed' ? 'default' : 
                          order.status === 'in_progress' ? 'secondary' : 
                          'outline'
                        }>
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {order.users?.discord_tag || 'Unknown'} • {order.service_type}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {order.price ? `$${order.price}` : 'Pending'}
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

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.avgOrderValue.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <DollarSign className="h-3 w-3 mr-1" />
              <span>Per order average</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalOrders > 0 
                ? Math.round((stats.completedOrders / stats.totalOrders) * 100) 
                : 0}%
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
              <span>{stats.completedOrders} of {stats.totalOrders} orders</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalOrders - stats.activeOrders - stats.completedOrders}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3 mr-1" />
              <span>Awaiting approval</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

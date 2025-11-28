"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, Download, RefreshCw, ShoppingBag, Server } from "lucide-react"
import { Link } from '@/navigation'
import { useToast } from "@/components/ui/use-toast"

interface Order {
  id: string
  order_number: string
  service_type: string
  service_name?: string
  project_name?: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  price?: number
  timeline?: string
  payment_status?: 'pending' | 'paid' | 'refunded'
  created_at: string
  completed_at?: string
}

const statusColors = {
  pending: 'secondary',
  quote_sent: 'secondary',
  in_progress: 'default',
  completed: 'default',
  cancelled: 'destructive'
} as const

export default function OrdersPage() {
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchOrders = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/orders')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch orders')
      }

      setOrders(data.orders || [])
    } catch (error) {
      console.error('Error fetching orders:', error)
      toast({
        title: "Error loading orders",
        description: "Could not fetch your orders.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const activeOrders = orders.filter(o => !['completed', 'cancelled'].includes(o.status))
  const completedOrders = orders.filter(o => o.status === 'completed')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-muted-foreground">
            Manage and track your project orders
          </p>
        </div>
        <Button onClick={fetchOrders} disabled={isLoading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-12 w-12 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">Active ({activeOrders.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedOrders.length})</TabsTrigger>
            <TabsTrigger value="all">All ({orders.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeOrders.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No active orders</p>
                  <Link href="/order">
                    <Button className="mt-4">Place New Order</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              activeOrders.map((order) => (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle>{order.order_number}</CardTitle>
                          <Badge variant={statusColors[order.status as keyof typeof statusColors]}>
                            {order.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <CardDescription>{order.service_name || order.service_type}</CardDescription>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {order.price ? `$${order.price}` : 'Pending'}
                        </p>
                        {order.payment_status && (
                          <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
                            {order.payment_status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-1">Description</h4>
                      <p className="text-sm text-muted-foreground">
                        {order.description || 'No description provided'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <p className="text-muted-foreground">Timeline: {order.timeline || 'TBD'}</p>
                        <p className="text-muted-foreground">Created: {new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                        {(order.status === 'in_progress' || order.status === 'completed') && (
                          <Link href={`/dashboard/bot/${order.id}`}>
                            <Button size="sm" className="gap-2">
                              <Server className="h-4 w-4" />
                              View Bot
                            </Button>
                          </Link>
                        )}
                        <Link href={`/dashboard/orders/${order.id}`}>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Eye className="h-4 w-4" />
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedOrders.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">No completed orders yet</p>
              </CardContent>
            </Card>
          ) : (
            completedOrders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle>{order.order_number}</CardTitle>
                        <Badge>Completed</Badge>
                      </div>
                      <CardDescription>{order.service_name || order.service_type}</CardDescription>
                    </div>
                    <p className="text-2xl font-bold">${order.price || 0}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {order.description || 'No description provided'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Completed: {order.completed_at && new Date(order.completed_at).toLocaleDateString()}
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/dashboard/bot/${order.id}`}>
                        <Button size="sm" className="gap-2">
                          <Server className="h-4 w-4" />
                          View Bot
                        </Button>
                      </Link>
                      <Link href={`/dashboard/orders/${order.id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" />
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <ShoppingBag className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No orders yet</p>
                <Link href="/order">
                  <Button className="mt-4">Place Your First Order</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle>{order.order_number}</CardTitle>
                        <Badge variant={statusColors[order.status as keyof typeof statusColors]}>
                          {order.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <CardDescription>{order.service_name || order.service_type}</CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        {order.price ? `$${order.price}` : 'Pending'}
                      </p>
                      {order.payment_status && (
                        <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
                          {order.payment_status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Created: {new Date(order.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex gap-2">
                      {(order.status === 'in_progress' || order.status === 'completed') && (
                        <Link href={`/dashboard/bot/${order.id}`}>
                          <Button size="sm" className="gap-2">
                            <Server className="h-4 w-4" />
                            View Bot
                          </Button>
                        </Link>
                      )}
                      <Link href={`/dashboard/orders/${order.id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" />
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

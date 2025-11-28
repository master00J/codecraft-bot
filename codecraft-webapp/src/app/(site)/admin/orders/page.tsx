"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, Send, CheckCircle, XCircle, RefreshCw, AlertCircle } from "lucide-react"
import { Link } from '@/navigation'
import { useToast } from "@/components/ui/use-toast"
import { SendQuoteDialog } from "@/components/admin/send-quote-dialog"

// Define order type
interface Order {
  id: string
  order_number: string
  discord_id: string
  service_type: string
  service_name?: string
  project_name?: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  price?: number
  budget?: string
  payment_status?: 'pending' | 'paid' | 'refunded'
  created_at: string
  completed_at?: string
  timeline?: string
  additional_info?: string
  contact_method?: string
  users?: {
    discord_tag: string
    email?: string
    avatar_url?: string
  }
}

// Mock data for fallback
const mockOrders: Order[] = [
  {
    id: '1',
    order_number: 'MOCK123',
    discord_id: '123456',
    service_type: 'Discord Bot',
    status: 'pending',
    created_at: new Date().toISOString(),
    users: { discord_tag: 'Demo#0001', email: 'demo@example.com' }
  }
]

export default function AdminOrdersPage() {
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/orders')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch orders')
      }

      setOrders(data.orders || [])
      
      if (data.orders && data.orders.length === 0) {
        toast({
          title: "No orders yet",
          description: "Orders will appear here when customers submit them.",
        })
      }
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError(err instanceof Error ? err.message : 'Failed to load orders')
      setOrders(mockOrders) // Fallback to mock data
      toast({
        title: "Error loading orders",
        description: "Using demo data. Check console for details.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const activeOrders = orders.filter(o => o.status === 'in_progress')
  const completedOrders = orders.filter(o => o.status === 'completed')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order Management</h1>
          <p className="text-muted-foreground">
            View and manage all customer orders
          </p>
        </div>
        <Button onClick={fetchOrders} disabled={isLoading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Error Loading Orders</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingOrders.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({activeOrders.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedOrders.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({orders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingOrders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{order.order_number}</CardTitle>
                      <Badge variant="secondary">Pending</Badge>
                    </div>
                    <CardDescription>
                      {order.users?.discord_tag || `Discord ID: ${order.discord_id}`} • {order.service_name || order.service_type}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <SendQuoteDialog
                      orderId={order.id}
                      currentPrice={order.price}
                      currentTimeline={order.timeline}
                      onQuoteSent={fetchOrders}
                    />
                    <Link href={`/admin/orders/${order.id}`}>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm"><strong>Project:</strong> {order.project_name || 'Unnamed'}</p>
                  <p className="text-sm text-muted-foreground">{order.description || 'No description'}</p>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Budget: ${order.budget || 'TBD'}</span>
                    <span>{new Date(order.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          {activeOrders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{order.order_number}</CardTitle>
                      <Badge>In Progress</Badge>
                    </div>
                    <CardDescription>
                      {order.users?.discord_tag || `Discord ID: ${order.discord_id}`} • {order.service_name || order.service_type}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">${order.price}</p>
                    <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
                      {order.payment_status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Timeline: {order.timeline || 'TBD'}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Mark Complete
                    </Button>
                    <Link href={`/admin/orders/${order.id}`}>
                      <Button size="sm" className="gap-2">
                        <Eye className="h-4 w-4" />
                        Manage
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedOrders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{order.order_number}</CardTitle>
                      <Badge>Completed</Badge>
                    </div>
                    <CardDescription>
                      {order.users?.discord_tag || `Discord ID: ${order.discord_id}`} • {order.service_name || order.service_type}
                    </CardDescription>
                  </div>
                  <p className="text-2xl font-bold">${order.price}</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Completed: {order.completed_at && new Date(order.completed_at).toLocaleDateString()}</span>
                  <Link href={`/admin/orders/${order.id}`}>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{order.order_number}</CardTitle>
                      <Badge variant={
                        order.status === 'completed' ? 'default' : 
                        order.status === 'in_progress' ? 'secondary' : 
                        'outline'
                      }>
                        {order.status}
                      </Badge>
                    </div>
                    <CardDescription>
                      {order.users?.discord_tag || `Discord ID: ${order.discord_id}`} • {order.service_name || order.service_type}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">
                      {order.price ? `$${order.price}` : 'No quote'}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString()}
                  </div>
                  <Link href={`/admin/orders/${order.id}`}>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}

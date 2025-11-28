"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ArrowLeft, 
  Calendar, 
  DollarSign, 
  User, 
  Mail, 
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Edit
} from "lucide-react"
import { Link } from '@/navigation'
import { useToast } from "@/components/ui/use-toast"
import { SendQuoteDialog } from "@/components/admin/send-quote-dialog"

interface Order {
  id: string
  order_number: string
  discord_id?: string
  user_id?: string
  service_type: string
  service_name?: string
  project_name?: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  price?: number
  budget?: string
  payment_status?: 'pending' | 'paid' | 'refunded'
  payment_method?: string
  created_at: string
  completed_at?: string
  timeline?: string
  additional_info?: string
  contact_method?: string
  discord_channel_id?: string
  service_details?: any
  selected_addons?: Array<{
    id: string
    name: string
    price: number
    billing_type: string
  }>
  users?: {
    discord_tag: string
    discord_id: string
    email?: string
    avatar_url?: string
  }
}

interface Payment {
  id: string
  amount: number
  transaction_id: string
  status: 'pending' | 'confirmed' | 'rejected'
  notes?: string
  created_at: string
  payment_methods?: {
    name: string
    type: string
    address: string
  }
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails()
    }
  }, [orderId])

  const fetchOrderDetails = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch order')
      }

      setOrder(data.order)
      setPayments(data.payments || [])
    } catch (err) {
      console.error('Error fetching order:', err)
      setError(err instanceof Error ? err.message : 'Failed to load order')
      toast({
        title: "Error loading order",
        description: "Could not fetch order details.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyPayment = async (paymentId: string, action: 'confirm' | 'reject') => {
    try {
      const response = await fetch(`/api/admin/payments/${paymentId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        throw new Error('Failed to verify payment')
      }

      toast({
        title: action === 'confirm' ? "Payment Confirmed!" : "Payment Rejected",
        description: action === 'confirm' 
          ? "Order payment status updated to paid." 
          : "Payment was rejected."
      })

      fetchOrderDetails()
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to process payment",
        variant: "destructive"
      })
    }
  }

  const handleStatusUpdate = async (newStatus: Order['status']) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      toast({
        title: "Status updated",
        description: `Order status changed to ${newStatus}`,
      })

      fetchOrderDetails()
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive"
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Loading...</h1>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Order Not Found</h1>
        </div>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error || 'Order not found'}</p>
            <Link href="/admin/orders">
              <Button className="mt-4">Back to Orders</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusColor = {
    pending: 'secondary',
    in_progress: 'default',
    completed: 'default',
    cancelled: 'destructive'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{order.order_number}</h1>
            <p className="text-muted-foreground">
              Order details and management
            </p>
          </div>
        </div>
        <Badge variant={statusColor[order.status] as any}>
          {order.status.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        {order.status === 'pending' && (
          <>
            <SendQuoteDialog
              orderId={order.id}
              currentPrice={order.price}
              currentTimeline={order.timeline}
              onQuoteSent={fetchOrderDetails}
            />
            <Button onClick={() => handleStatusUpdate('in_progress')} variant="outline" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Start Project
            </Button>
          </>
        )}
        {order.status === 'in_progress' && (
          <Button onClick={() => handleStatusUpdate('completed')} className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Mark as Completed
          </Button>
        )}
        {order.status !== 'cancelled' && (
          <Button 
            variant="destructive" 
            onClick={() => handleStatusUpdate('cancelled')}
            className="gap-2"
          >
            <XCircle className="h-4 w-4" />
            Cancel Order
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
              <CardDescription>Project details and requirements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1">Service Type</h3>
                <p className="text-lg">{order.service_name || order.service_type}</p>
              </div>
              
              {order.project_name && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Project Name</h3>
                  <p>{order.project_name}</p>
                </div>
              )}
              
              {order.description && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Description</h3>
                  <p className="text-sm whitespace-pre-wrap">{order.description}</p>
                </div>
              )}
              
              {order.additional_info && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Additional Information</h3>
                  <p className="text-sm whitespace-pre-wrap">{order.additional_info}</p>
                </div>
              )}

              {order.service_details && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Service Details</h3>
                  <pre className="text-sm bg-muted p-3 rounded-lg overflow-auto">
                    {JSON.stringify(order.service_details, null, 2)}
                  </pre>
                </div>
              )}

              {order.selected_addons && order.selected_addons.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Selected Add-ons</h3>
                  <div className="space-y-2">
                    {order.selected_addons.map((addon: any) => (
                      <div key={addon.id} className="flex items-center justify-between bg-muted p-2 rounded">
                        <span className="text-sm">{addon.name}</span>
                        <span className="text-sm font-medium">
                          €{addon.price}
                          {addon.billing_type !== 'one_time' && ` /${addon.billing_type === 'yearly' ? 'year' : 'month'}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline & Budget */}
          <Card>
            <CardHeader>
              <CardTitle>Project Timeline & Budget</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Budget</h3>
                  <p className="text-2xl font-bold">
                    {order.price ? `$${order.price}` : order.budget || 'TBD'}
                  </p>
                  {order.payment_status && (
                    <Badge className="mt-2" variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
                      {order.payment_status}
                    </Badge>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Timeline</h3>
                  <p className="text-lg">{order.timeline || 'To be determined'}</p>
                </div>
              </div>

              {order.payment_method && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Payment Method</h3>
                  <p>{order.payment_method}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payments Section */}
          {payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Customer Payments
                </CardTitle>
                <CardDescription>
                  Payment submissions from customer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {payments.map((payment) => (
                  <div key={payment.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">
                          ${payment.amount} via {payment.payment_methods?.name || 'Unknown'}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(payment.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={
                        payment.status === 'confirmed' ? 'default' :
                        payment.status === 'rejected' ? 'destructive' :
                        'secondary'
                      }>
                        {payment.status}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium">Transaction ID:</p>
                        <code className="text-sm bg-muted px-2 py-1 rounded block break-all">
                          {payment.transaction_id}
                        </code>
                      </div>

                      {payment.notes && (
                        <div>
                          <p className="text-sm font-medium">Customer Notes:</p>
                          <p className="text-sm text-muted-foreground">{payment.notes}</p>
                        </div>
                      )}

                      {payment.payment_methods && (
                        <div>
                          <p className="text-sm font-medium">Payment Address:</p>
                          <code className="text-xs text-muted-foreground">
                            {payment.payment_methods.address}
                          </code>
                        </div>
                      )}
                    </div>

                    {payment.status === 'pending' && (
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          onClick={() => handleVerifyPayment(payment.id, 'confirm')}
                          className="gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Confirm Payment
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleVerifyPayment(payment.id, 'reject')}
                          className="gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {payment.status === 'confirmed' && (
                      <div className="flex items-center gap-2 text-green-600 pt-2 border-t">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Payment Verified</span>
                      </div>
                    )}

                    {payment.status === 'rejected' && (
                      <div className="flex items-center gap-2 text-destructive pt-2 border-t">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Payment Rejected</span>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.users?.avatar_url && (
                <img 
                  src={order.users.avatar_url} 
                  alt="Avatar" 
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div>
                <p className="font-semibold">{order.users?.discord_tag || 'Unknown User'}</p>
                <p className="text-sm text-muted-foreground">
                  Discord ID: {order.users?.discord_id || order.discord_id || 'N/A'}
                </p>
              </div>
              {order.users?.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${order.users.email}`} className="hover:underline">
                    {order.users.email}
                  </a>
                </div>
              )}
              {order.contact_method && (
                <div className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span>{order.contact_method}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Meta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Order Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              {order.completed_at && (
                <div>
                  <p className="text-muted-foreground">Completed</p>
                  <p className="font-medium">
                    {new Date(order.completed_at).toLocaleString()}
                  </p>
                </div>
              )}
              {order.discord_channel_id && (
                <div>
                  <p className="text-muted-foreground">Discord Channel</p>
                  <p className="font-mono text-xs">{order.discord_channel_id}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}


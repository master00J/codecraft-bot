"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  ArrowLeft, 
  Calendar, 
  DollarSign, 
  Clock,
  CheckCircle,
  CreditCard,
  AlertCircle,
  Loader2,
  Copy,
  Upload,
  Server
} from "lucide-react"
import { Link } from '@/navigation'
import { useToast } from "@/components/ui/use-toast"

interface Quote {
  id: string
  price: number
  timeline?: string
  notes?: string
  payment_methods: string[]
  status: 'pending' | 'accepted' | 'rejected'
  sent_at: string
}

interface PaymentMethod {
  id: string
  name: string
  type: string
  address: string
  instructions?: string
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
  }
}

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
  additional_info?: string
  selected_addons?: Array<{
    id: string
    name: string
    price: number
    billing_type: string
  }>
}

export default function CustomerOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<PaymentMethod[]>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("")
  const [transactionId, setTransactionId] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
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
      // Fetch order
      const orderResponse = await fetch(`/api/orders/${orderId}`)
      const orderData = await orderResponse.json()

      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Failed to fetch order')
      }

      setOrder(orderData.order)
      setPayments(orderData.payments || [])

      // Fetch quote if exists
      if (orderData.quote) {
        setQuote(orderData.quote)

        // Fetch payment methods
        const methodsResponse = await fetch('/api/payment-methods')
        const methodsData = await methodsResponse.json()
        
        if (methodsResponse.ok && methodsData.methods) {
          // Filter to only show methods that were selected in the quote
          const selectedMethods = methodsData.methods.filter((m: PaymentMethod) => 
            orderData.quote.payment_methods.includes(m.id)
          )
          setAvailablePaymentMethods(selectedMethods)
        }
      }
    } catch (err) {
      console.error('Error fetching order:', err)
      setError(err instanceof Error ? err.message : 'Failed to load order')
      toast({
        title: "Error",
        description: "Could not load order details.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAcceptQuote = async () => {
    try {
      const response = await fetch(`/api/quotes/${quote?.id}/accept`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to accept quote')
      }

      toast({
        title: "Quote Accepted!",
        description: "You can now proceed with payment."
      })

      fetchOrderDetails()
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to accept quote",
        variant: "destructive"
      })
    }
  }

  const handleSubmitPayment = async () => {
    if (!selectedPaymentMethod) {
      toast({
        title: "Error",
        description: "Please select a payment method",
        variant: "destructive"
      })
      return
    }

    if (!transactionId) {
      toast({
        title: "Error",
        description: "Please provide a transaction ID or reference",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          quote_id: quote?.id,
          payment_method_id: selectedPaymentMethod,
          amount: order?.price || quote?.price,
          transaction_id: transactionId,
          notes: paymentNotes
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit payment')
      }

      toast({
        title: "Payment Submitted!",
        description: "Your payment is being verified. You'll be notified once confirmed."
      })

      // Reset form
      setTransactionId("")
      setPaymentNotes("")
      fetchOrderDetails()
    } catch (err) {
      console.error('Error submitting payment:', err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit payment",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: "Address copied to clipboard"
    })
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
            <Link href="/dashboard/orders">
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
              {order.service_name || order.service_type}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(order.status === 'in_progress' || order.status === 'completed') && (
            <Link href={`/dashboard/bot/${order.id}`}>
              <Button variant="outline" className="gap-2">
                <Server className="h-4 w-4" />
                View Bot Status
              </Button>
            </Link>
          )}
          <Badge variant={statusColor[order.status] as any}>
            {order.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
              <CardDescription>Your project details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

              {order.selected_addons && order.selected_addons.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Selected Add-ons</h3>
                  <div className="space-y-2">
                    {order.selected_addons.map((addon: any) => (
                      <div key={addon.id} className="flex items-center justify-between bg-primary/5 p-2 rounded border border-primary/20">
                        <span className="text-sm font-medium">{addon.name}</span>
                        <span className="text-sm font-bold">
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

          {/* Quote Section */}
          {quote && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Price Quote
                </CardTitle>
                <CardDescription>
                  Quote sent on {new Date(quote.sent_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-3xl font-bold">${quote.price}</p>
                  {quote.timeline && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <Clock className="h-3 w-3 inline mr-1" />
                      Timeline: {quote.timeline}
                    </p>
                  )}
                </div>

                {quote.notes && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-1">Notes from admin:</p>
                    <p className="text-sm text-muted-foreground">{quote.notes}</p>
                  </div>
                )}

                {quote.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button onClick={handleAcceptQuote} className="gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Accept Quote
                    </Button>
                  </div>
                )}

                {quote.status === 'accepted' && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Quote Accepted - Proceed with payment below</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Payment Status - Show if customer already submitted payment */}
          {payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Your Payment
                </CardTitle>
                <CardDescription>
                  Payment submission status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {payments.map((payment) => (
                  <div key={payment.id} className={`border rounded-lg p-4 space-y-3 ${
                    payment.status === 'confirmed' ? 'border-green-500 bg-green-50 dark:bg-green-950' :
                    payment.status === 'rejected' ? 'border-red-500 bg-red-50 dark:bg-red-950' :
                    'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">${payment.amount}</h4>
                        <p className="text-sm text-muted-foreground">
                          {payment.payment_methods?.name} ({payment.payment_methods?.type})
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Submitted {new Date(payment.created_at).toLocaleString()}
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

                    <div>
                      <p className="text-sm font-medium">Transaction ID:</p>
                      <code className="text-sm bg-muted px-2 py-1 rounded block break-all">
                        {payment.transaction_id}
                      </code>
                    </div>

                    {payment.status === 'pending' && (
                      <div className="flex items-center gap-2 text-yellow-600">
                        <Clock className="h-5 w-5" />
                        <span className="text-sm font-medium">Payment is being verified by our team...</span>
                      </div>
                    )}

                    {payment.status === 'confirmed' && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">Payment Confirmed! Work has started.</span>
                      </div>
                    )}

                    {payment.status === 'rejected' && (
                      <div>
                        <div className="flex items-center gap-2 text-red-600 mb-2">
                          <AlertCircle className="h-5 w-5" />
                          <span className="text-sm font-medium">Payment was rejected</span>
                        </div>
                        {payment.notes && (
                          <p className="text-sm text-muted-foreground">
                            Admin notes: {payment.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Payment Section - Show if quote accepted but no payment submitted yet */}
          {quote && quote.status === 'accepted' && order.payment_status !== 'paid' && payments.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment
                </CardTitle>
                <CardDescription>
                  Select a payment method and submit proof of payment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Payment Method Selection */}
                <div className="space-y-2">
                  <Label>Select Payment Method</Label>
                  <div className="grid gap-2">
                    {availablePaymentMethods.map((method) => (
                      <div
                        key={method.id}
                        onClick={() => setSelectedPaymentMethod(method.id)}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          selectedPaymentMethod === method.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold">{method.name}</h4>
                            <Badge variant="outline" className="mt-1">{method.type}</Badge>
                          </div>
                          {selectedPaymentMethod === method.id && (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <code className="text-sm bg-muted px-2 py-1 rounded flex-1 break-all">
                            {method.address}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              copyToClipboard(method.address)
                            }}
                            className="gap-2"
                          >
                            <Copy className="h-3 w-3" />
                            Copy
                          </Button>
                        </div>
                        {method.instructions && (
                          <p className="text-sm text-muted-foreground mt-2">
                            ℹ️ {method.instructions}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Proof Form */}
                {selectedPaymentMethod && (
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-semibold">Submit Payment Proof</h4>
                    
                    <div className="space-y-2">
                      <Label htmlFor="transaction_id">Transaction ID / Reference *</Label>
                      <Input
                        id="transaction_id"
                        placeholder="Enter transaction hash, reference number, or payment ID"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Provide the transaction ID or proof of payment
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Additional Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Any additional information about the payment..."
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <Button
                      onClick={handleSubmitPayment}
                      disabled={isSubmitting || !transactionId}
                      className="w-full gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Submit Payment
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      Your payment will be verified by our team. You'll receive a notification once confirmed.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Payment Confirmed */}
          {order.payment_status === 'paid' && (
            <Card className="border-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-green-600">
                  <CheckCircle className="h-8 w-8" />
                  <div>
                    <h3 className="font-semibold text-lg">Payment Confirmed</h3>
                    <p className="text-sm text-muted-foreground">
                      Your payment has been verified. Work has started on your project!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
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
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Current Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${
                  order.status === 'completed' ? 'bg-green-500' :
                  order.status === 'in_progress' ? 'bg-blue-500' :
                  order.status === 'cancelled' ? 'bg-red-500' :
                  'bg-yellow-500'
                }`} />
                <span className="text-sm font-medium capitalize">
                  {order.status.replace('_', ' ')}
                </span>
              </div>
              
              {order.payment_status && (
                <>
                  <div className="h-px bg-border my-2" />
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm capitalize">
                      Payment: {order.payment_status}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Help */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Have questions about your order or payment?
              </p>
              <Link href="/contact">
                <Button variant="outline" size="sm" className="w-full">
                  Contact Support
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}


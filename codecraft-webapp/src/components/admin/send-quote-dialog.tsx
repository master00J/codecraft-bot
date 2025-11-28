"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Send, Loader2, Plus, X } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface PaymentMethod {
  id: string
  name: string
  type: string
  address: string
  instructions?: string
  is_active: boolean
}

interface SendQuoteDialogProps {
  orderId: string
  currentPrice?: number
  currentTimeline?: string
  onQuoteSent?: () => void
}

export function SendQuoteDialog({ 
  orderId, 
  currentPrice,
  currentTimeline,
  onQuoteSent 
}: SendQuoteDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMethods, setLoadingMethods] = useState(true)
  
  const [price, setPrice] = useState(currentPrice?.toString() || "")
  const [timeline, setTimeline] = useState(currentTimeline || "")
  const [notes, setNotes] = useState("")
  
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [selectedMethods, setSelectedMethods] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      fetchPaymentMethods()
    }
  }, [open])

  const fetchPaymentMethods = async () => {
    setLoadingMethods(true)
    try {
      const response = await fetch('/api/admin/payment-methods')
      const data = await response.json()
      if (response.ok) {
        const activeMethods = data.methods?.filter((m: PaymentMethod) => m.is_active) || []
        setPaymentMethods(activeMethods)
        // Pre-select all active methods
        setSelectedMethods(activeMethods.map((m: PaymentMethod) => m.id))
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error)
    } finally {
      setLoadingMethods(false)
    }
  }

  const togglePaymentMethod = (methodId: string) => {
    setSelectedMethods(prev =>
      prev.includes(methodId)
        ? prev.filter(id => id !== methodId)
        : [...prev, methodId]
    )
  }

  const handleSendQuote = async () => {
    if (!price) {
      toast({
        title: "Error",
        description: "Price is required",
        variant: "destructive"
      })
      return
    }

    if (selectedMethods.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one payment method",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          price: parseFloat(price),
          timeline,
          notes,
          payment_methods: selectedMethods
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send quote')
      }

      toast({
        title: "Quote Sent!",
        description: "The customer will be notified and can view the quote in their dashboard."
      })

      setOpen(false)
      if (onQuoteSent) onQuoteSent()
    } catch (error) {
      console.error('Error sending quote:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send quote",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Send className="h-4 w-4" />
          Send Quote
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Quote to Customer</DialogTitle>
          <DialogDescription>
            Set the price, timeline, and select payment methods for this order.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="price">Price ($) *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              placeholder="1000.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeline">Timeline</Label>
            <Input
              id="timeline"
              placeholder="e.g., 2-3 weeks"
              value={timeline}
              onChange={(e) => setTimeline(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional information for the customer..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Methods *</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Select which payment methods to offer
            </p>
            {loadingMethods ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading payment methods...
              </div>
            ) : paymentMethods.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No payment methods configured. 
                <a href="/admin/settings" className="text-primary hover:underline ml-1">
                  Configure payment methods
                </a>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {paymentMethods.map((method) => (
                  <Badge
                    key={method.id}
                    variant={selectedMethods.includes(method.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => togglePaymentMethod(method.id)}
                  >
                    {method.name}
                    {selectedMethods.includes(method.id) ? (
                      <X className="ml-1 h-3 w-3" />
                    ) : (
                      <Plus className="ml-1 h-3 w-3" />
                    )}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendQuote}
            disabled={loading || !price || selectedMethods.length === 0}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Quote
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


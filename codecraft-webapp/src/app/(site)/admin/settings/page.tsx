"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Settings, 
  CreditCard, 
  Plus, 
  Trash2, 
  Check,
  X,
  Loader2,
  RefreshCw
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface PaymentMethod {
  id: string
  name: string
  type: string
  address: string
  instructions?: string
  is_active: boolean
  display_order: number
}

export default function AdminSettingsPage() {
  const { toast } = useToast()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // New payment method form
  const [newMethod, setNewMethod] = useState({
    name: "",
    type: "crypto",
    address: "",
    instructions: ""
  })

  useEffect(() => {
    fetchPaymentMethods()
  }, [])

  const fetchPaymentMethods = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/payment-methods')
      const data = await response.json()
      if (response.ok) {
        setPaymentMethods(data.methods || [])
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error)
      toast({
        title: "Error",
        description: "Failed to load payment methods",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddMethod = async () => {
    if (!newMethod.name || !newMethod.address) {
      toast({
        title: "Error",
        description: "Name and address are required",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newMethod,
          display_order: paymentMethods.length
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add payment method')
      }

      toast({
        title: "Success",
        description: "Payment method added successfully"
      })

      // Reset form
      setNewMethod({
        name: "",
        type: "crypto",
        address: "",
        instructions: ""
      })

      fetchPaymentMethods()
    } catch (error) {
      console.error('Error adding payment method:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add payment method",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/payment-methods/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      })

      if (!response.ok) {
        throw new Error('Failed to update payment method')
      }

      toast({
        title: "Success",
        description: `Payment method ${!currentStatus ? 'activated' : 'deactivated'}`
      })

      fetchPaymentMethods()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update payment method",
        variant: "destructive"
      })
    }
  }

  const deleteMethod = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return

    try {
      const response = await fetch(`/api/admin/payment-methods/${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete payment method')
      }

      toast({
        title: "Success",
        description: data.softDeleted 
          ? "Payment method deactivated (in use by existing payments)"
          : "Payment method deleted successfully"
      })

      fetchPaymentMethods()
    } catch (error) {
      console.error('Error deleting payment method:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete payment method",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Settings</h1>
          <p className="text-muted-foreground">
            Configure system settings and preferences
          </p>
        </div>
        <Button onClick={fetchPaymentMethods} disabled={loading} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="payment-methods" className="space-y-6">
        <TabsList>
          <TabsTrigger value="payment-methods">
            <CreditCard className="h-4 w-4 mr-2" />
            Payment Methods
          </TabsTrigger>
          <TabsTrigger value="general">
            <Settings className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payment-methods" className="space-y-6">
          {/* Add New Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Payment Method
              </CardTitle>
              <CardDescription>
                Add a new payment method for customers (crypto wallet, bank account, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Method Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Bitcoin, USDT (TRC20), Bank Transfer NL"
                    value={newMethod.name}
                    onChange={(e) => setNewMethod({ ...newMethod, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <select
                    id="type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={newMethod.type}
                    onChange={(e) => setNewMethod({ ...newMethod, type: e.target.value })}
                  >
                    <option value="crypto">Cryptocurrency</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="paypal">PayPal</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address/Account Number *</Label>
                <Input
                  id="address"
                  placeholder="Wallet address, IBAN, or account identifier"
                  value={newMethod.address}
                  onChange={(e) => setNewMethod({ ...newMethod, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions (Optional)</Label>
                <Textarea
                  id="instructions"
                  placeholder="Additional instructions for customers (e.g., network type, reference to include, etc.)"
                  value={newMethod.instructions}
                  onChange={(e) => setNewMethod({ ...newMethod, instructions: e.target.value })}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleAddMethod}
                disabled={saving || !newMethod.name || !newMethod.address}
                className="gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Payment Method
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Existing Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle>Configured Payment Methods</CardTitle>
              <CardDescription>
                Manage existing payment methods. Active methods will be shown to customers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : paymentMethods.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No payment methods configured yet</p>
                  <p className="text-sm">Add your first payment method above</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{method.name}</h4>
                          <Badge variant="outline">{method.type}</Badge>
                          <Badge variant={method.is_active ? "default" : "secondary"}>
                            {method.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground font-mono">{method.address}</p>
                        {method.instructions && (
                          <p className="text-sm text-muted-foreground mt-1">{method.instructions}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleActive(method.id, method.is_active)}
                          className="gap-2"
                        >
                          {method.is_active ? (
                            <>
                              <X className="h-4 w-4" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              Activate
                            </>
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMethod(method.id)}
                          className="gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Coming soon...</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Additional settings will be available here in future updates.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Ticket,
  Plus,
  Trash2,
  Edit,
  Copy,
  Check,
  RefreshCw,
  Loader2
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface DiscountCode {
  id: string
  code: string
  description: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  max_uses: number | null
  current_uses: number
  max_uses_per_user: number
  min_order_value: number | null
  applicable_tiers: string[] | null
  first_time_only: boolean
  valid_from: string
  valid_until: string | null
  is_active: boolean
  created_at: string
  usage_count: number
}

export default function DiscountCodesPage() {
  const { toast } = useToast()
  const [codes, setCodes] = useState<DiscountCode[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: 10,
    maxUses: '',
    maxUsesPerUser: 1,
    minOrderValue: '',
    applicableTiers: [] as string[],
    firstTimeOnly: false,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: ''
  })

  useEffect(() => {
    fetchCodes()
  }, [])

  const fetchCodes = async () => {
    try {
      const response = await fetch('/api/admin/discount-codes')
      const data = await response.json()

      if (response.ok) {
        setCodes(data.codes || [])
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error fetching codes:', error)
      toast({
        title: "Error",
        description: "Failed to load discount codes",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/admin/discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
          minOrderValue: formData.minOrderValue ? parseFloat(formData.minOrderValue) : null,
          applicableTiers: formData.applicableTiers.length > 0 ? formData.applicableTiers : null,
          validUntil: formData.validUntil || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      toast({
        title: "Success!",
        description: `Discount code ${data.code.code} created`
      })

      setDialogOpen(false)
      resetForm()
      fetchCodes()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create code",
        variant: "destructive"
      })
    }
  }

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete discount code ${code}?`)) return

    try {
      const response = await fetch(`/api/admin/discount-codes/${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      toast({
        title: "Success",
        description: data.message || "Discount code deleted"
      })

      fetchCodes()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete code",
        variant: "destructive"
      })
    }
  }

  const handleToggleActive = async (code: DiscountCode) => {
    try {
      const response = await fetch(`/api/admin/discount-codes/${code.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: !code.is_active
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update')
      }

      toast({
        title: "Success",
        description: `Code ${code.is_active ? 'deactivated' : 'activated'}`
      })

      fetchCodes()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update code",
        variant: "destructive"
      })
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      discountType: 'percentage',
      discountValue: 10,
      maxUses: '',
      maxUsesPerUser: 1,
      minOrderValue: '',
      applicableTiers: [],
      firstTimeOnly: false,
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: ''
    })
    setEditingCode(null)
  }

  const activeCodes = codes.filter(c => c.is_active)
  const inactiveCodes = codes.filter(c => !c.is_active)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Discount Codes</h1>
          <p className="text-muted-foreground">Manage promotional codes and coupons</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchCodes} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Code
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{codes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCodes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Uses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {codes.reduce((sum, c) => sum + (c.usage_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{inactiveCodes.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Codes */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Active Discount Codes
          </CardTitle>
          <CardDescription>Currently available codes</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : activeCodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active discount codes
            </div>
          ) : (
            <div className="space-y-4">
              {activeCodes.map((code) => (
                <div
                  key={code.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <code className="text-lg font-bold bg-primary/10 px-3 py-1 rounded">
                        {code.code}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyCode(code.code)}
                        className="h-8 w-8 p-0"
                      >
                        {copiedCode === code.code ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Badge variant={code.discount_type === 'percentage' ? 'default' : 'secondary'}>
                        {code.discount_type === 'percentage' 
                          ? `${code.discount_value}% OFF`
                          : `€${code.discount_value} OFF`
                        }
                      </Badge>
                      {code.first_time_only && (
                        <Badge variant="outline">First Time Only</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {code.description}
                    </p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Used: {code.usage_count} {code.max_uses ? `/ ${code.max_uses}` : ''}</span>
                      {code.min_order_value && <span>Min: €{code.min_order_value}</span>}
                      {code.applicable_tiers && <span>Tiers: {code.applicable_tiers.join(', ')}</span>}
                      {code.valid_until && (
                        <span>Expires: {new Date(code.valid_until).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(code)}
                    >
                      Deactivate
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(code.id, code.code)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inactive Codes */}
      {inactiveCodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inactive Codes</CardTitle>
            <CardDescription>Deactivated or expired codes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inactiveCodes.map((code) => (
                <div
                  key={code.id}
                  className="flex items-center justify-between p-3 border rounded opacity-60"
                >
                  <div>
                    <code className="font-bold">{code.code}</code>
                    <span className="text-sm text-muted-foreground ml-3">
                      {code.discount_type === 'percentage' 
                        ? `${code.discount_value}% OFF`
                        : `€${code.discount_value} OFF`
                      }
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(code)}
                    >
                      Activate
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(code.id, code.code)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCode ? 'Edit Discount Code' : 'Create New Discount Code'}
            </DialogTitle>
            <DialogDescription>
              Set up a promotional discount code for customers
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  placeholder="SUMMER2025"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountType">Discount Type *</Label>
                <Select
                  value={formData.discountType}
                  onValueChange={(value) => setFormData({ ...formData, discountType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="10% off for new customers"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discountValue">
                  Discount Value * ({formData.discountType === 'percentage' ? '%' : '€'})
                </Label>
                <Input
                  id="discountValue"
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minOrderValue">Min. Order Value (€)</Label>
                <Input
                  id="minOrderValue"
                  type="number"
                  placeholder="Optional"
                  value={formData.minOrderValue}
                  onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxUses">Max Total Uses</Label>
                <Input
                  id="maxUses"
                  type="number"
                  placeholder="Unlimited"
                  value={formData.maxUses}
                  onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUsesPerUser">Max Uses Per User</Label>
                <Input
                  id="maxUsesPerUser"
                  type="number"
                  value={formData.maxUsesPerUser}
                  onChange={(e) => setFormData({ ...formData, maxUsesPerUser: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="validFrom">Valid From</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validUntil">Valid Until</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="firstTimeOnly"
                checked={formData.firstTimeOnly}
                onChange={(e) => setFormData({ ...formData, firstTimeOnly: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="firstTimeOnly" className="cursor-pointer">
                First-time customers only
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDialogOpen(false)
              resetForm()
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>
              Create Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


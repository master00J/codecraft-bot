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
  DollarSign, 
  Plus, 
  Trash2, 
  Edit,
  Star,
  RefreshCw,
  Loader2,
  Check,
  X
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface PricingTier {
  id: string
  category_id: string
  name: string
  price: number
  timeline: string
  features: string[]
  is_popular: boolean
  display_order: number
}

interface ServiceCategory {
  id: string
  name: string
  description?: string
  icon?: string
  display_order: number
  pricing_tiers: PricingTier[]
}

interface Addon {
  id: string
  name: string
  description?: string
  price: number
  billing_type: 'monthly' | 'yearly' | 'one_time'
  billing_interval?: string
  icon?: string
  restrictions: string[]
  is_active: boolean
}

export default function AdminPricingPage() {
  const { toast } = useToast()
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [addons, setAddons] = useState<Addon[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Category form
  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
    icon: ""
  })

  // Tier form
  const [selectedCategoryId, setSelectedCategoryId] = useState("")
  const [newTier, setNewTier] = useState({
    name: "",
    price: "",
    timeline: "",
    features: "",
    is_popular: false
  })

  // Edit tier state
  const [editingTierId, setEditingTierId] = useState<string | null>(null)
  const [editTier, setEditTier] = useState({
    id: "",
    name: "",
    price: "",
    timeline: "",
    features: "",
    is_popular: false
  })
  const [selectedTierAddons, setSelectedTierAddons] = useState<string[]>([])

  // Add-on form
  const [newAddon, setNewAddon] = useState({
    name: "",
    description: "",
    price: "",
    billing_type: "monthly",
    icon: ""
  })

  // Edit add-on state
  const [editingAddonId, setEditingAddonId] = useState<string | null>(null)
  const [editAddon, setEditAddon] = useState({
    id: "",
    name: "",
    description: "",
    price: "",
    billing_type: "monthly",
    icon: ""
  })

  useEffect(() => {
    fetchPricing()
    fetchAddons()
  }, [])

  const fetchAddons = async () => {
    try {
      const response = await fetch('/api/admin/pricing/addons')
      const data = await response.json()
      if (response.ok) {
        setAddons(data.addons || [])
      }
    } catch (error) {
      console.error('Error fetching addons:', error)
    }
  }

  const fetchPricing = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/pricing/categories')
      const data = await response.json()
      if (response.ok) {
        setCategories(data.categories || [])
        if (data.categories?.length > 0 && !selectedCategoryId) {
          setSelectedCategoryId(data.categories[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching pricing:', error)
      toast({
        title: "Error",
        description: "Failed to load pricing",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddCategory = async () => {
    if (!newCategory.name) {
      toast({
        title: "Error",
        description: "Category name is required",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/pricing/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCategory,
          display_order: categories.length
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add category')
      }

      toast({
        title: "Success",
        description: "Category added successfully"
      })

      setNewCategory({ name: "", description: "", icon: "" })
      fetchPricing()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add category",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAddTier = async () => {
    if (!selectedCategoryId || !newTier.name || !newTier.price) {
      toast({
        title: "Error",
        description: "Category, name, and price are required",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      const category = categories.find(c => c.id === selectedCategoryId)
      const response = await fetch('/api/admin/pricing/tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: selectedCategoryId,
          name: newTier.name,
          price: parseFloat(newTier.price),
          timeline: newTier.timeline,
          features: newTier.features.split('\n').filter(f => f.trim()),
          is_popular: newTier.is_popular,
          display_order: category?.pricing_tiers?.length || 0
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add pricing tier')
      }

      toast({
        title: "Success",
        description: "Pricing tier added successfully"
      })

      setNewTier({ name: "", price: "", timeline: "", features: "", is_popular: false })
      fetchPricing()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add tier",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const startEditTier = async (tier: PricingTier) => {
    setEditingTierId(tier.id)
    setEditTier({
      id: tier.id,
      name: tier.name,
      price: tier.price.toString(),
      timeline: tier.timeline,
      features: tier.features.join('\n'),
      is_popular: tier.is_popular
    })

    // Fetch which add-ons are enabled for this tier
    try {
      const response = await fetch(`/api/admin/pricing/tiers/${tier.id}/addons`)
      const data = await response.json()
      if (response.ok) {
        setSelectedTierAddons(data.addon_ids || [])
      }
    } catch (error) {
      console.error('Error fetching tier addons:', error)
    }
  }

  const cancelEdit = () => {
    setEditingTierId(null)
    setEditTier({
      id: "",
      name: "",
      price: "",
      timeline: "",
      features: "",
      is_popular: false
    })
    setSelectedTierAddons([])
  }

  const toggleTierAddon = (addonId: string) => {
    setSelectedTierAddons(prev =>
      prev.includes(addonId)
        ? prev.filter(id => id !== addonId)
        : [...prev, addonId]
    )
  }

  const handleUpdateTier = async () => {
    if (!editTier.name || !editTier.price) {
      toast({
        title: "Error",
        description: "Name and price are required",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      // Update tier details
      const tierResponse = await fetch(`/api/admin/pricing/tiers/${editTier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editTier.name,
          price: parseFloat(editTier.price),
          timeline: editTier.timeline,
          features: editTier.features.split('\n').filter(f => f.trim()),
          is_popular: editTier.is_popular
        })
      })

      if (!tierResponse.ok) {
        throw new Error('Failed to update tier')
      }

      // Update allowed add-ons
      const addonsResponse = await fetch(`/api/admin/pricing/tiers/${editTier.id}/addons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addon_ids: selectedTierAddons
        })
      })

      if (!addonsResponse.ok) {
        throw new Error('Failed to update add-ons')
      }

      toast({
        title: "Success",
        description: "Pricing tier and add-ons updated successfully"
      })

      cancelEdit()
      fetchPricing()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update tier",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const togglePopular = async (tierId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/pricing/tiers/${tierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_popular: !currentStatus })
      })

      if (!response.ok) {
        throw new Error('Failed to update')
      }

      toast({
        title: "Success",
        description: `Tier ${!currentStatus ? 'marked as popular' : 'unmarked'}`
      })

      fetchPricing()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update tier",
        variant: "destructive"
      })
    }
  }

  const deleteTier = async (tierId: string) => {
    if (!confirm('Are you sure you want to delete this pricing tier?')) return

    try {
      const response = await fetch(`/api/admin/pricing/tiers/${tierId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete')
      }

      toast({
        title: "Success",
        description: "Pricing tier deleted"
      })

      fetchPricing()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete tier",
        variant: "destructive"
      })
    }
  }

  const startEditAddon = (addon: Addon) => {
    setEditingAddonId(addon.id)
    setEditAddon({
      id: addon.id,
      name: addon.name,
      description: addon.description || "",
      price: addon.price.toString(),
      billing_type: addon.billing_type,
      icon: addon.icon || ""
    })
  }

  const cancelEditAddon = () => {
    setEditingAddonId(null)
    setEditAddon({
      id: "",
      name: "",
      description: "",
      price: "",
      billing_type: "monthly",
      icon: ""
    })
  }

  const handleUpdateAddon = async () => {
    if (!editAddon.name || !editAddon.price) {
      toast({
        title: "Error",
        description: "Name and price are required",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/admin/pricing/addons/${editAddon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editAddon.name,
          description: editAddon.description,
          price: parseFloat(editAddon.price),
          billing_type: editAddon.billing_type,
          billing_interval: editAddon.billing_type === 'one_time' ? null : 'month',
          icon: editAddon.icon
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update add-on')
      }

      toast({
        title: "Success",
        description: "Add-on updated successfully"
      })

      cancelEditAddon()
      fetchAddons()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update add-on",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAddAddon = async () => {
    if (!newAddon.name || !newAddon.price) {
      toast({
        title: "Error",
        description: "Name and price are required",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/pricing/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newAddon,
          price: parseFloat(newAddon.price),
          billing_interval: newAddon.billing_type === 'one_time' ? null : 'month',
          display_order: addons.length
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add add-on')
      }

      toast({
        title: "Success",
        description: "Add-on created successfully"
      })

      setNewAddon({ name: "", description: "", price: "", billing_type: "monthly", icon: "" })
      fetchAddons()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add add-on",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const deleteAddon = async (addonId: string) => {
    if (!confirm('Are you sure you want to delete this add-on?')) return

    try {
      const response = await fetch(`/api/admin/pricing/addons/${addonId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete')
      }

      toast({
        title: "Success",
        description: "Add-on deleted"
      })

      fetchAddons()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete add-on",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pricing Management</h1>
          <p className="text-muted-foreground">
            Manage service categories and pricing tiers
          </p>
        </div>
        <Button onClick={fetchPricing} disabled={loading} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="tiers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tiers">
            <DollarSign className="h-4 w-4 mr-2" />
            Pricing Tiers
          </TabsTrigger>
          <TabsTrigger value="addons">
            Add-ons
          </TabsTrigger>
          <TabsTrigger value="categories">
            Categories
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tiers" className="space-y-6">
          {/* Add Pricing Tier */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Pricing Tier
              </CardTitle>
              <CardDescription>
                Add a new pricing tier to a service category
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Service Category *</Label>
                <select
                  id="category"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                >
                  <option value="">Select a category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tier_name">Tier Name *</Label>
                  <Input
                    id="tier_name"
                    placeholder="e.g., Basic Bot, Advanced Bot"
                    value={newTier.name}
                    onChange={(e) => setNewTier({ ...newTier, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price ($) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder="25.00"
                    value={newTier.price}
                    onChange={(e) => setNewTier({ ...newTier, price: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeline">Timeline</Label>
                <Input
                  id="timeline"
                  placeholder="e.g., 2 days, 2-3 weeks"
                  value={newTier.timeline}
                  onChange={(e) => setNewTier({ ...newTier, timeline: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="features">Features (one per line) *</Label>
                <Textarea
                  id="features"
                  placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                  value={newTier.features}
                  onChange={(e) => setNewTier({ ...newTier, features: e.target.value })}
                  rows={6}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_popular"
                  checked={newTier.is_popular}
                  onChange={(e) => setNewTier({ ...newTier, is_popular: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="is_popular" className="cursor-pointer">
                  Mark as "Most Popular"
                </Label>
              </div>

              <Button
                onClick={handleAddTier}
                disabled={saving || !selectedCategoryId || !newTier.name || !newTier.price}
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
                    Add Pricing Tier
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Existing Tiers by Category */}
          {categories.map((category) => (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {category.icon && <span>{category.icon}</span>}
                  {category.name}
                </CardTitle>
                <CardDescription>
                  {category.pricing_tiers?.length || 0} pricing tiers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {category.pricing_tiers?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No pricing tiers yet. Add one above.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {category.pricing_tiers?.map((tier) => (
                      <div key={tier.id} className="border rounded-lg p-4">
                        {editingTierId === tier.id ? (
                          // Edit Mode
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Tier Name</Label>
                                <Input
                                  value={editTier.name}
                                  onChange={(e) => setEditTier({ ...editTier, name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Price ($)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editTier.price}
                                  onChange={(e) => setEditTier({ ...editTier, price: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Timeline</Label>
                              <Input
                                value={editTier.timeline}
                                onChange={(e) => setEditTier({ ...editTier, timeline: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Features (one per line)</Label>
                              <Textarea
                                value={editTier.features}
                                onChange={(e) => setEditTier({ ...editTier, features: e.target.value })}
                                rows={6}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editTier.is_popular}
                                onChange={(e) => setEditTier({ ...editTier, is_popular: e.target.checked })}
                                className="h-4 w-4"
                              />
                              <Label>Mark as Popular</Label>
                            </div>

                            {/* Add-ons Selection */}
                            {addons.length > 0 && (
                              <div className="space-y-2 pt-4 border-t">
                                <Label>Available Add-ons for this Tier</Label>
                                <p className="text-xs text-muted-foreground mb-2">
                                  Select which add-ons customers can purchase with this tier
                                </p>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {addons.map((addon) => (
                                    <div
                                      key={addon.id}
                                      onClick={() => toggleTierAddon(addon.id)}
                                      className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedTierAddons.includes(addon.id)}
                                        onChange={() => {}}
                                        className="h-4 w-4"
                                      />
                                      <span className="flex-1 text-sm">
                                        {addon.icon} {addon.name}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        €{addon.price}/{addon.billing_type === 'one_time' ? 'once' : addon.billing_type === 'yearly' ? 'yr' : 'mo'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground italic">
                                  {selectedTierAddons.length} add-on(s) selected
                                </p>
                              </div>
                            )}

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={handleUpdateTier}
                                disabled={saving}
                                className="gap-2"
                              >
                                {saving ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-4 w-4" />
                                    Save Changes
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEdit}
                                disabled={saving}
                                className="gap-2"
                              >
                                <X className="h-4 w-4" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // View Mode
                          <>
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold">{tier.name}</h4>
                                  {tier.is_popular && (
                                    <Badge className="gap-1">
                                      <Star className="h-3 w-3" />
                                      Popular
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-2xl font-bold">${tier.price}</p>
                                <p className="text-sm text-muted-foreground">Timeline: {tier.timeline}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditTier(tier)}
                                  className="gap-2"
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => togglePopular(tier.id, tier.is_popular)}
                                  className="gap-2"
                                >
                                  <Star className={`h-4 w-4 ${tier.is_popular ? 'fill-current' : ''}`} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteTier(tier.id)}
                                  className="gap-2"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-1">
                              {tier.features.map((feature, i) => (
                                <p key={i} className="text-sm text-muted-foreground">
                                  • {feature}
                                </p>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="addons" className="space-y-6">
          {/* Add Add-on */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Pricing Add-on
              </CardTitle>
              <CardDescription>
                Create optional add-ons like Source Code, Priority Support, White-label (Max 5 recommended)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="addon_name">Add-on Name *</Label>
                  <Input
                    id="addon_name"
                    placeholder="e.g., Source Code License, Priority Support"
                    value={newAddon.name}
                    onChange={(e) => setNewAddon({ ...newAddon, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addon_icon">Icon (Emoji)</Label>
                  <Input
                    id="addon_icon"
                    placeholder="e.g., 💻, ⚡, 🎨"
                    value={newAddon.icon}
                    onChange={(e) => setNewAddon({ ...newAddon, icon: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="addon_description">Description</Label>
                <Input
                  id="addon_description"
                  placeholder="Brief description of what this add-on includes"
                  value={newAddon.description}
                  onChange={(e) => setNewAddon({ ...newAddon, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="addon_price">Price (€) *</Label>
                  <Input
                    id="addon_price"
                    type="number"
                    step="0.01"
                    placeholder="25.00"
                    value={newAddon.price}
                    onChange={(e) => setNewAddon({ ...newAddon, price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addon_billing">Billing Type</Label>
                  <select
                    id="addon_billing"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newAddon.billing_type}
                    onChange={(e) => setNewAddon({ ...newAddon, billing_type: e.target.value })}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="one_time">One-time</option>
                  </select>
                </div>
              </div>

              <Button
                onClick={handleAddAddon}
                disabled={saving || !newAddon.name || !newAddon.price || addons.length >= 5}
                className="gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : addons.length >= 5 ? (
                  <>Maximum 5 add-ons reached</>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Add-on
                  </>
                )}
              </Button>
              {addons.length >= 5 && (
                <p className="text-sm text-muted-foreground">
                  You've reached the maximum of 5 add-ons. Delete one to add another.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Existing Add-ons */}
          <Card>
            <CardHeader>
              <CardTitle>Configured Add-ons ({addons.length}/5)</CardTitle>
              <CardDescription>
                Optional add-ons customers can purchase
              </CardDescription>
            </CardHeader>
            <CardContent>
              {addons.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Plus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No add-ons yet</p>
                  <p className="text-sm">Add your first add-on above (max 5)</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {addons.map((addon) => (
                    <div key={addon.id} className="border rounded-lg p-4">
                      {editingAddonId === addon.id ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold flex items-center gap-2">
                              <Edit className="h-4 w-4" />
                              Editing Add-on
                            </h4>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEditAddon}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Name</Label>
                              <Input
                                placeholder="e.g., Source Code License"
                                value={editAddon.name}
                                onChange={(e) => setEditAddon({ ...editAddon, name: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Icon (Emoji)</Label>
                              <Input
                                placeholder="e.g., 📦, 🚀, ⚡"
                                value={editAddon.icon}
                                onChange={(e) => setEditAddon({ ...editAddon, icon: e.target.value })}
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                              placeholder="Optional description"
                              value={editAddon.description}
                              onChange={(e) => setEditAddon({ ...editAddon, description: e.target.value })}
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Price (€)</Label>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={editAddon.price}
                                onChange={(e) => setEditAddon({ ...editAddon, price: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Billing Type</Label>
                              <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2"
                                value={editAddon.billing_type}
                                onChange={(e) => setEditAddon({ ...editAddon, billing_type: e.target.value })}
                              >
                                <option value="monthly">Monthly</option>
                                <option value="yearly">Yearly</option>
                                <option value="one_time">One-time</option>
                              </select>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              onClick={handleUpdateAddon}
                              disabled={saving}
                              className="gap-2"
                            >
                              {saving ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Updating...
                                </>
                              ) : (
                                <>
                                  <Check className="h-4 w-4" />
                                  Update Add-on
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={cancelEditAddon}
                              disabled={saving}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {addon.icon && <span className="text-2xl">{addon.icon}</span>}
                              <h4 className="font-semibold">{addon.name}</h4>
                              <Badge variant="outline">
                                {addon.billing_type === 'one_time' ? 'One-time' : 
                                 addon.billing_type === 'yearly' ? 'Yearly' : 'Monthly'}
                              </Badge>
                            </div>
                            {addon.description && (
                              <p className="text-sm text-muted-foreground mb-2">{addon.description}</p>
                            )}
                            <p className="text-xl font-bold">
                              €{addon.price}
                              {addon.billing_type !== 'one_time' && (
                                <span className="text-sm font-normal text-muted-foreground">
                                  /{addon.billing_type === 'yearly' ? 'year' : 'month'}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditAddon(addon)}
                              className="gap-2"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteAddon(addon.id)}
                              className="gap-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          {/* Add Category */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Service Category
              </CardTitle>
              <CardDescription>
                Add a new service category (e.g., Discord Bots, Websites)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cat_name">Category Name *</Label>
                  <Input
                    id="cat_name"
                    placeholder="e.g., Discord Bots, Websites"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon (Emoji)</Label>
                  <Input
                    id="icon"
                    placeholder="e.g., 🤖, 🌐, 🛒"
                    value={newCategory.icon}
                    onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Brief description of this service category"
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                />
              </div>

              <Button
                onClick={handleAddCategory}
                disabled={saving || !newCategory.name}
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
                    Add Category
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Existing Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Service Categories</CardTitle>
              <CardDescription>
                Manage your service categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No categories yet. Add one above.
                </p>
              ) : (
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <h4 className="font-semibold">
                          {category.icon && <span className="mr-2">{category.icon}</span>}
                          {category.name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {category.pricing_tiers?.length || 0} pricing tiers
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { 
  Briefcase, 
  Plus, 
  Trash2, 
  Edit, 
  Star,
  RefreshCw,
  Loader2,
  X,
  Check,
  Image as ImageIcon
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import Image from "next/image"

interface PortfolioItem {
  id: string
  title: string
  category: string
  client?: string
  description?: string
  technologies?: string[]
  features?: string[]
  results?: string
  timeline?: string
  budget?: string
  image_url?: string
  is_featured: boolean
  display_order: number
}

export default function AdminPortfolioPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({
    title: "",
    category: "",
    client: "",
    description: "",
    technologies: "",
    features: "",
    results: "",
    timeline: "",
    budget: "",
    image_url: "",
    is_featured: false
  })

  useEffect(() => {
    fetchPortfolio()
  }, [])

  const fetchPortfolio = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/portfolio')
      const data = await response.json()
      if (response.ok) {
        setItems(data.items || [])
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error)
      toast({
        title: "Error",
        description: "Failed to load portfolio items",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setForm({
      title: "",
      category: "",
      client: "",
      description: "",
      technologies: "",
      features: "",
      results: "",
      timeline: "",
      budget: "",
      image_url: "",
      is_featured: false
    })
    setEditingId(null)
  }

  const handleAdd = async () => {
    if (!form.title || !form.category) {
      toast({
        title: "Error",
        description: "Title and category are required",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          technologies: form.technologies ? form.technologies.split(',').map(t => t.trim()) : [],
          features: form.features ? form.features.split('\n').filter(f => f.trim()) : [],
          display_order: items.length
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add portfolio item')
      }

      toast({
        title: "Success",
        description: "Portfolio item added successfully"
      })

      resetForm()
      fetchPortfolio()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add item",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleFeatured = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/portfolio/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_featured: !currentStatus })
      })

      if (!response.ok) {
        throw new Error('Failed to update')
      }

      toast({
        title: "Success",
        description: `Item ${!currentStatus ? 'featured' : 'unfeatured'}`
      })

      fetchPortfolio()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive"
      })
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this portfolio item?')) return

    try {
      const response = await fetch(`/api/admin/portfolio/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete')
      }

      toast({
        title: "Success",
        description: "Portfolio item deleted"
      })

      fetchPortfolio()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Portfolio Management</h1>
          <p className="text-muted-foreground">
            Manage your portfolio showcases
          </p>
        </div>
        <Button onClick={fetchPortfolio} disabled={loading} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Add New Item */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Portfolio Item
          </CardTitle>
          <CardDescription>
            Showcase your best work to potential clients
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                placeholder="e.g., E-Commerce Platform"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                placeholder="e.g., 🛒 E-Commerce, 🤖 Discord Bot"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Input
                id="client"
                placeholder="Client name or 'Own Project'"
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Budget</Label>
              <Input
                id="budget"
                placeholder="e.g., $2,500"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the project..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timeline">Timeline</Label>
              <Input
                id="timeline"
                placeholder="e.g., 2-3 weeks"
                value={form.timeline}
                onChange={(e) => setForm({ ...form, timeline: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="results">Results</Label>
              <Input
                id="results"
                placeholder="e.g., 50k+ revenue in first month"
                value={form.results}
                onChange={(e) => setForm({ ...form, results: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="technologies">Technologies (comma-separated)</Label>
            <Input
              id="technologies"
              placeholder="Next.js, TypeScript, Tailwind CSS, Supabase"
              value={form.technologies}
              onChange={(e) => setForm({ ...form, technologies: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="features">Key Features (one per line)</Label>
            <Textarea
              id="features"
              placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_url">Image URL</Label>
            <Input
              id="image_url"
              placeholder="https://example.com/image.png"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Upload image to Discord or Imgur and paste URL here
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_featured"
              checked={form.is_featured}
              onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
              className="h-4 w-4"
            />
            <Label htmlFor="is_featured" className="cursor-pointer">
              Mark as Featured (shows in hero section)
            </Label>
          </div>

          <Button
            onClick={handleAdd}
            disabled={saving || !form.title || !form.category}
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
                Add Portfolio Item
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Items */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Items</CardTitle>
          <CardDescription>
            Manage existing portfolio showcases
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No portfolio items yet</p>
              <p className="text-sm">Add your first project above</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex gap-4">
                    {item.image_url ? (
                      <div className="relative w-32 h-32 flex-shrink-0 rounded overflow-hidden">
                        <Image
                          src={item.image_url}
                          alt={item.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-32 h-32 flex-shrink-0 bg-muted rounded flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-lg">{item.title}</h4>
                            <Badge variant="outline">{item.category}</Badge>
                            {item.is_featured && (
                              <Badge className="gap-1">
                                <Star className="h-3 w-3" />
                                Featured
                              </Badge>
                            )}
                          </div>
                          {item.client && (
                            <p className="text-sm text-muted-foreground">{item.client}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleFeatured(item.id, item.is_featured)}
                            className="gap-2"
                          >
                            <Star className={`h-4 w-4 ${item.is_featured ? 'fill-current' : ''}`} />
                            {item.is_featured ? 'Unfeature' : 'Feature'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteItem(item.id)}
                            className="gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>

                      {item.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      )}

                      <div className="flex flex-wrap gap-4 text-sm">
                        {item.timeline && (
                          <span className="text-muted-foreground">Timeline: {item.timeline}</span>
                        )}
                        {item.budget && (
                          <span className="text-muted-foreground">Budget: {item.budget}</span>
                        )}
                        {item.results && (
                          <span className="text-green-600 font-medium">✓ {item.results}</span>
                        )}
                      </div>

                      {item.technologies && item.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.technologies.slice(0, 5).map((tech) => (
                            <Badge key={tech} variant="outline" className="text-xs">
                              {tech}
                            </Badge>
                          ))}
                          {item.technologies.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{item.technologies.length - 5}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


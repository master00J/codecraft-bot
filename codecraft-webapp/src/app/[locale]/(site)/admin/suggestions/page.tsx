'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { 
  Lightbulb, 
  Bug, 
  Sparkles, 
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Filter,
  Eye,
  Trash2,
  TrendingUp,
  CheckCheck,
  Zap
} from 'lucide-react'
import type { Suggestion } from '@/types/database'

export default function AdminSuggestionsPage() {
  const { toast } = useToast()

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)
  const [updating, setUpdating] = useState(false)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Update form
  const [newStatus, setNewStatus] = useState('')
  const [newPriority, setNewPriority] = useState('')
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    loadSuggestions()
  }, [])

  const loadSuggestions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/suggestions')
      
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Error loading suggestions:', error)
      toast({
        title: 'Error',
        description: 'Failed to load suggestions',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedSuggestion) return

    try {
      setUpdating(true)
      const response = await fetch(`/api/suggestions/${selectedSuggestion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus || selectedSuggestion.status,
          priority: newPriority || selectedSuggestion.priority,
          admin_notes: adminNotes,
        }),
      })

      if (response.ok) {
        toast({
          title: '✅ Updated!',
          description: 'Suggestion updated successfully',
        })
        setSelectedSuggestion(null)
        await loadSuggestions()
      } else {
        throw new Error('Failed to update suggestion')
      }
    } catch (error) {
      console.error('Error updating suggestion:', error)
      toast({
        title: 'Error',
        description: 'Failed to update suggestion',
        variant: 'destructive',
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this suggestion?')) return

    try {
      const response = await fetch(`/api/suggestions/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: '🗑️ Deleted',
          description: 'Suggestion deleted successfully',
        })
        await loadSuggestions()
      } else {
        throw new Error('Failed to delete suggestion')
      }
    } catch (error) {
      console.error('Error deleting suggestion:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete suggestion',
        variant: 'destructive',
      })
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'bug':
        return <Bug className="h-4 w-4" />
      case 'feature':
        return <Lightbulb className="h-4 w-4" />
      case 'improvement':
        return <Sparkles className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'bug':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'feature':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      case 'improvement':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      default:
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20'
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; icon: any; label: string }> = {
      pending: {
        className: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
        icon: <Clock className="h-3 w-3 mr-1" />,
        label: 'Pending',
      },
      under_review: {
        className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        icon: <AlertCircle className="h-3 w-3 mr-1" />,
        label: 'Under Review',
      },
      planned: {
        className: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
        icon: <TrendingUp className="h-3 w-3 mr-1" />,
        label: 'Planned',
      },
      in_progress: {
        className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
        icon: <Zap className="h-3 w-3 mr-1" />,
        label: 'In Progress',
      },
      completed: {
        className: 'bg-green-500/10 text-green-600 border-green-500/20',
        icon: <CheckCheck className="h-3 w-3 mr-1" />,
        label: 'Completed',
      },
      rejected: {
        className: 'bg-red-500/10 text-red-600 border-red-500/20',
        icon: <XCircle className="h-3 w-3 mr-1" />,
        label: 'Rejected',
      },
    }

    const config = variants[status] || variants.pending
    
    return (
      <Badge variant="outline" className={`flex items-center gap-1 ${config.className}`}>
        {config.icon}
        {config.label}
      </Badge>
    )
  }

  // Filter suggestions
  const filteredSuggestions = suggestions.filter((suggestion) => {
    if (statusFilter !== 'all' && suggestion.status !== statusFilter) return false
    if (categoryFilter !== 'all' && suggestion.category !== categoryFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        suggestion.title.toLowerCase().includes(query) ||
        suggestion.description.toLowerCase().includes(query) ||
        suggestion.discord_tag.toLowerCase().includes(query)
      )
    }
    return true
  })

  // Statistics
  const stats = {
    total: suggestions.length,
    pending: suggestions.filter(s => s.status === 'pending').length,
    in_progress: suggestions.filter(s => s.status === 'in_progress').length,
    completed: suggestions.filter(s => s.status === 'completed').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-4 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl border border-yellow-500/30">
          <Lightbulb className="h-8 w-8 text-yellow-500" />
        </div>
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent mb-2">
            Suggestions & Feedback
          </h1>
          <p className="text-lg text-muted-foreground">
            Manage user suggestions and feedback for ComCraft improvements
          </p>
        </div>
      </div>

      {/* Statistics - Enhanced */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-2 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Suggestions</p>
                <p className="text-3xl font-bold text-primary">{stats.total}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-2 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-br from-gray-500/5 to-gray-500/10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Pending Review</p>
                <p className="text-3xl font-bold text-gray-600">{stats.pending}</p>
              </div>
              <div className="p-3 bg-gray-500/10 rounded-xl">
                <Clock className="h-8 w-8 text-gray-500" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-2 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-br from-yellow-500/5 to-yellow-500/10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">In Progress</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.in_progress}</p>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-xl">
                <Zap className="h-8 w-8 text-yellow-500" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-2 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-br from-green-500/5 to-green-500/10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Completed</p>
                <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-xl">
                <CheckCheck className="h-8 w-8 text-green-500" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters - Enhanced */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label className="mb-2 font-semibold">Search</Label>
              <Input
                placeholder="Search by title, description, or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11"
              />
            </div>

            <div>
              <Label className="mb-2 font-semibold">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 font-semibold">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="feature">Feature Request</SelectItem>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="improvement">Improvement</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggestions List - Enhanced */}
      <Card className="border-2 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">All Suggestions</CardTitle>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {filteredSuggestions.length} Results
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading suggestions...</p>
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="text-center py-16">
              <div className="p-6 bg-muted/50 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No suggestions found</h3>
              <p className="text-muted-foreground">
                Try adjusting your filters or search query
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSuggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="group border-2 rounded-xl p-6 hover:border-primary/50 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg border ${getCategoryColor(suggestion.category)}`}>
                          {getCategoryIcon(suggestion.category)}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                            {suggestion.title}
                          </h3>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {suggestion.category}
                          </Badge>
                        </div>
                        {getStatusBadge(suggestion.status)}
                      </div>
                      
                      <p className="text-muted-foreground leading-relaxed mb-4">
                        {suggestion.description}
                      </p>
                      
                      <div className="flex items-center flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <strong>From:</strong> {suggestion.discord_tag}
                        </span>
                        <span>•</span>
                        <span>{new Date(suggestion.created_at).toLocaleDateString()}</span>
                        {suggestion.guild_id && (
                          <>
                            <span>•</span>
                            <span>Guild: {suggestion.guild_id.slice(0, 8)}...</span>
                          </>
                        )}
                        {suggestion.priority && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs">
                              {suggestion.priority === 'high' && '🔥'}
                              {suggestion.priority === 'medium' && '⚡'}
                              {suggestion.priority === 'low' && '📌'}
                              {' '}Priority: {suggestion.priority}
                            </Badge>
                          </>
                        )}
                      </div>

                      {suggestion.admin_notes && (
                        <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                          <p className="text-sm font-semibold text-primary mb-1">Admin Notes:</p>
                          <p className="text-sm leading-relaxed">{suggestion.admin_notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-10 w-10"
                            onClick={() => {
                              setSelectedSuggestion(suggestion)
                              setNewStatus(suggestion.status)
                              setNewPriority(suggestion.priority || '')
                              setAdminNotes(suggestion.admin_notes || '')
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-2xl">Manage Suggestion</DialogTitle>
                            <DialogDescription>
                              Update status, priority, and add response for the user
                            </DialogDescription>
                          </DialogHeader>
                          
                          {selectedSuggestion && (
                            <div className="space-y-6">
                              <div className="p-4 bg-muted/50 rounded-lg">
                                <h4 className="font-semibold text-lg mb-2">{selectedSuggestion.title}</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">{selectedSuggestion.description}</p>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <Label className="mb-2 font-semibold">Status</Label>
                                  <Select value={newStatus} onValueChange={setNewStatus}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="under_review">Under Review</SelectItem>
                                      <SelectItem value="planned">Planned</SelectItem>
                                      <SelectItem value="in_progress">In Progress</SelectItem>
                                      <SelectItem value="completed">Completed</SelectItem>
                                      <SelectItem value="rejected">Rejected</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <Label className="mb-2 font-semibold">Priority</Label>
                                  <Select value={newPriority} onValueChange={setNewPriority}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Set priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="low">Low</SelectItem>
                                      <SelectItem value="medium">Medium</SelectItem>
                                      <SelectItem value="high">High</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div>
                                <Label className="mb-2 font-semibold">Admin Response (Visible to User)</Label>
                                <Textarea
                                  placeholder="Add notes or response for the user..."
                                  value={adminNotes}
                                  onChange={(e) => setAdminNotes(e.target.value)}
                                  rows={5}
                                  className="resize-none"
                                />
                              </div>

                              <div className="flex gap-3 justify-end pt-4 border-t">
                                <Button
                                  variant="outline"
                                  onClick={() => setSelectedSuggestion(null)}
                                >
                                  Cancel
                                </Button>
                                <Button onClick={handleUpdate} disabled={updating} className="min-w-32">
                                  {updating ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Updating...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      Update
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 w-10 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDelete(suggestion.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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


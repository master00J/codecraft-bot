'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Link } from '@/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { 
  ArrowLeft, 
  Lightbulb, 
  Bug, 
  Sparkles, 
  MessageSquare, 
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  CheckCheck,
  Zap
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import type { Suggestion } from '@/types/database'

export default function SuggestionsPage() {
  const params = useParams()
  const { toast } = useToast()
  const { data: session } = useSession()
  const guildId = params.guildId as string

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<'bug' | 'feature' | 'improvement' | 'other'>('feature')

  // Load user's suggestions
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
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !description.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          guild_id: guildId,
        }),
      })

      if (response.ok) {
        toast({
          title: '✨ Success!',
          description: 'Your suggestion has been submitted successfully. We\'ll review it soon!',
        })
        
        // Reset form
        setTitle('')
        setDescription('')
        setCategory('feature')
        
        // Reload suggestions
        await loadSuggestions()
      } else {
        throw new Error('Failed to submit suggestion')
      }
    } catch (error) {
      console.error('Error submitting suggestion:', error)
      toast({
        title: 'Error',
        description: 'Failed to submit suggestion. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
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
        label: 'Pending Review',
      },
      under_review: {
        className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        icon: <AlertCircle className="h-3 w-3 mr-1" />,
        label: 'Under Review',
      },
      planned: {
        className: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
        icon: <CheckCircle className="h-3 w-3 mr-1" />,
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/comcraft/dashboard/${guildId}`}>
            <Button variant="ghost" className="mb-4 hover:bg-primary/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          
          <div className="flex items-start gap-4 mb-4">
            <div className="p-4 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl border border-yellow-500/30">
              <Lightbulb className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent mb-2">
                Suggestions & Feedback
              </h1>
              <p className="text-lg text-muted-foreground">
                Help us improve ComCraft by sharing your ideas, reporting bugs, and suggesting improvements
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Submit Form - Enhanced Design */}
          <div className="lg:col-span-2">
            <Card className="border-2 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Send className="h-6 w-6 text-primary" />
                  Submit New Suggestion
                </CardTitle>
                <CardDescription className="text-base">
                  Share your brilliant ideas or report issues to help us make ComCraft better
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="category" className="text-base font-semibold mb-2 flex items-center gap-2">
                      Category *
                    </Label>
                    <Select
                      value={category}
                      onValueChange={(value: any) => setCategory(value)}
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="feature">
                          <div className="flex items-center gap-3 py-1">
                            <div className="p-2 bg-yellow-500/10 rounded-lg">
                              <Lightbulb className="h-4 w-4 text-yellow-500" />
                            </div>
                            <div>
                              <p className="font-semibold">Feature Request</p>
                              <p className="text-xs text-muted-foreground">Suggest new functionality</p>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="bug">
                          <div className="flex items-center gap-3 py-1">
                            <div className="p-2 bg-red-500/10 rounded-lg">
                              <Bug className="h-4 w-4 text-red-500" />
                            </div>
                            <div>
                              <p className="font-semibold">Bug Report</p>
                              <p className="text-xs text-muted-foreground">Report an issue</p>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="improvement">
                          <div className="flex items-center gap-3 py-1">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                              <Sparkles className="h-4 w-4 text-blue-500" />
                            </div>
                            <div>
                              <p className="font-semibold">Improvement</p>
                              <p className="text-xs text-muted-foreground">Enhance existing features</p>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="other">
                          <div className="flex items-center gap-3 py-1">
                            <div className="p-2 bg-purple-500/10 rounded-lg">
                              <MessageSquare className="h-4 w-4 text-purple-500" />
                            </div>
                            <div>
                              <p className="font-semibold">Other</p>
                              <p className="text-xs text-muted-foreground">General feedback</p>
                            </div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="title" className="text-base font-semibold mb-2">Title *</Label>
                    <Input
                      id="title"
                      placeholder="Brief, descriptive title of your suggestion..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={100}
                      required
                      className="h-12 text-base"
                    />
                    <p className="text-xs text-muted-foreground mt-2 flex justify-between">
                      <span>Make it clear and concise</span>
                      <span className={title.length > 80 ? 'text-orange-500' : ''}>{title.length}/100</span>
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-base font-semibold mb-2">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Provide detailed information about your suggestion. Include:
• What problem does this solve?
• How should it work?
• Any examples or mockups?
• Why is this important?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={8}
                      maxLength={1000}
                      required
                      className="text-base resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-2 flex justify-between">
                      <span>The more details, the better we can understand your needs</span>
                      <span className={description.length > 900 ? 'text-orange-500' : ''}>{description.length}/1000</span>
                    </p>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={submitting} 
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-5 w-5" />
                        Submit Suggestion
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Info Card - Enhanced Design */}
          <div className="space-y-6">
            <Card className="border-2 shadow-lg">
              <CardHeader className="bg-gradient-to-br from-primary/5 to-primary/10">
                <CardTitle className="text-xl">💡 Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="p-2 bg-yellow-500/10 rounded-lg">
                      <Lightbulb className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Feature Requests</h4>
                      <p className="text-sm text-muted-foreground">
                        Suggest new features or functionality you'd like to see in ComCraft
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="p-2 bg-red-500/10 rounded-lg">
                      <Bug className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Bug Reports</h4>
                      <p className="text-sm text-muted-foreground">
                        Report issues. Include steps to reproduce if possible
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Sparkles className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Improvements</h4>
                      <p className="text-sm text-muted-foreground">
                        Suggest ways to improve existing features
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">💡 Pro Tip:</strong> Be specific and detailed. The more information you provide, the better we can understand and implement your suggestion!
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="border-2 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Your Submissions</p>
                  <p className="text-4xl font-bold text-primary">{suggestions.length}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {suggestions.filter(s => s.status === 'completed').length} completed
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* User's Suggestions - Enhanced Design */}
        <div className="mt-8">
          <Card className="border-2 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Your Suggestions</CardTitle>
                  <CardDescription className="text-base mt-1">
                    Track the status of your submitted suggestions
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-lg px-4 py-2">
                  {suggestions.length} Total
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Loading your suggestions...</p>
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-16">
                  <div className="p-6 bg-muted/50 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No suggestions yet</h3>
                  <p className="text-muted-foreground">
                    Be the first to share your ideas and help us improve ComCraft!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="group border-2 rounded-xl p-6 hover:border-primary/50 hover:shadow-lg transition-all bg-card"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 rounded-lg border ${getCategoryColor(suggestion.category)}`}>
                              {getCategoryIcon(suggestion.category)}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                                {suggestion.title}
                              </h3>
                            </div>
                            {getStatusBadge(suggestion.status)}
                          </div>
                          <p className="text-muted-foreground leading-relaxed mb-4">
                            {suggestion.description}
                          </p>
                        </div>
                      </div>
                      
                      {suggestion.admin_notes && (
                        <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <MessageSquare className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-primary mb-1">Admin Response:</p>
                              <p className="text-sm leading-relaxed">{suggestion.admin_notes}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {new Date(suggestion.created_at).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                        {suggestion.priority && (
                          <Badge variant="outline" className="text-xs">
                            {suggestion.priority === 'high' && '🔥'}
                            {suggestion.priority === 'medium' && '⚡'}
                            {suggestion.priority === 'low' && '📌'}
                            {' '}Priority: {suggestion.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}


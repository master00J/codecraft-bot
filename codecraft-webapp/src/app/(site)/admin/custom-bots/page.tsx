'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw, Server, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface CustomBot {
  guild_id: string
  bot_username: string | null
  pterodactyl_server_uuid: string | null
  bot_webhook_url: string | null
  runs_on_pterodactyl: boolean | null
  bot_online: boolean
}

interface Statistics {
  total_servers: number
  with_webhook_url: number
  without_webhook_url: number
}

interface UpdateResult {
  guild_id: string
  status: 'updated' | 'skipped' | 'error'
  webhook_url?: string
  error?: string
}

export default function CustomBotsAdminPage() {
  const { toast } = useToast()
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateResults, setUpdateResults] = useState<UpdateResult[]>([])
  const [baseUrlPattern, setBaseUrlPattern] = useState<string>('')

  const fetchStatistics = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/custom-bots/update-webhook-urls')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch statistics')
      }

      setStatistics(data.statistics)
      setBaseUrlPattern(data.base_url_pattern || 'http://<IP>:<PORT>')
    } catch (err) {
      console.error('Error fetching statistics:', err)
      toast({
        title: "Error loading statistics",
        description: err instanceof Error ? err.message : "Could not fetch custom bot statistics.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateWebhookUrls = async () => {
    setIsUpdating(true)
    setUpdateResults([])
    
    try {
      const response = await fetch('/api/admin/custom-bots/update-webhook-urls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update webhook URLs')
      }

      setUpdateResults(data.results || [])
      
      toast({
        title: "Update complete",
        description: `Updated ${data.updated} servers, ${data.failed} failed, ${data.skipped} already had URLs.`,
        variant: data.failed > 0 ? "destructive" : "default"
      })

      // Refresh statistics after update
      await fetchStatistics()
    } catch (err) {
      console.error('Error updating webhook URLs:', err)
      toast({
        title: "Error updating webhook URLs",
        description: err instanceof Error ? err.message : "Could not update webhook URLs.",
        variant: "destructive"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  useEffect(() => {
    fetchStatistics()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Custom Bots Management</h1>
          <p className="text-muted-foreground">Loading statistics...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-12 w-12 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Custom Bots Management</h1>
          <p className="text-muted-foreground">
            Manage webhook URLs for custom bot containers running on Pterodactyl
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchStatistics}
            disabled={isLoading || isUpdating}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={updateWebhookUrls}
            disabled={isUpdating || isLoading}
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Server className="h-4 w-4 mr-2" />
                Update Webhook URLs
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Servers</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.total_servers}</div>
              <p className="text-xs text-muted-foreground">
                Pterodactyl containers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">With Webhook URL</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{statistics.with_webhook_url}</div>
              <p className="text-xs text-muted-foreground">
                Ready for notifications
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Without Webhook URL</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{statistics.without_webhook_url}</div>
              <p className="text-xs text-muted-foreground">
                Need update
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Base URL Pattern */}
      {baseUrlPattern && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Current webhook URL pattern</CardDescription>
          </CardHeader>
          <CardContent>
            <code className="text-sm bg-muted px-3 py-2 rounded block">
              {baseUrlPattern}
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              Set via <code className="text-xs">CUSTOM_BOT_BASE_URL</code> environment variable
            </p>
          </CardContent>
        </Card>
      )}

      {/* Update Results */}
      {updateResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Update Results</CardTitle>
            <CardDescription>
              {updateResults.filter(r => r.status === 'updated').length} updated,{' '}
              {updateResults.filter(r => r.status === 'error').length} failed,{' '}
              {updateResults.filter(r => r.status === 'skipped').length} skipped
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {updateResults.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {result.status === 'updated' && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    {result.status === 'error' && (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    {result.status === 'skipped' && (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                    <div>
                      <div className="font-medium">Guild: {result.guild_id}</div>
                      {result.webhook_url && (
                        <code className="text-xs text-muted-foreground">
                          {result.webhook_url}
                        </code>
                      )}
                      {result.error && (
                        <div className="text-xs text-red-500 mt-1">{result.error}</div>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={
                      result.status === 'updated'
                        ? 'default'
                        : result.status === 'error'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {result.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>About Webhook URLs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Custom bots running in Docker containers need a webhook URL to receive notifications
            from the main bot server. This URL is constructed from the container's allocation
            (IP:Port) and stored in the database.
          </p>
          <p>
            <strong>When to update:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>After creating new containers (should be automatic)</li>
            <li>If containers were created before this feature was added</li>
            <li>If webhook URLs are missing or incorrect</li>
          </ul>
          <p className="pt-2">
            <strong>Note:</strong> The webhook URL pattern can be customized via the{' '}
            <code className="text-xs">CUSTOM_BOT_BASE_URL</code> environment variable.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}


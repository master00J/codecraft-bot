"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Server, 
  Activity, 
  HardDrive, 
  Cpu, 
  TrendingUp,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUpCircle
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Link } from '@/navigation'

export default function CustomerBotStatusPage() {
  const params = useParams()
  const orderId = params.orderId as string
  const { toast } = useToast()

  const [botData, setBotData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBotStatus()
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchBotStatus()
    }, 10000)
    
    return () => clearInterval(interval)
  }, [orderId])

  const fetchBotStatus = async () => {
    try {
      const response = await fetch(`/api/customer/bot/${orderId}`)
      const data = await response.json()

      if (response.ok) {
        setBotData(data)
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to load bot status",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error fetching bot status:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!botData) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-lg font-semibold">Bot Not Found</p>
            <p className="text-sm text-muted-foreground">This order doesn't have a bot deployment yet</p>
            <Link href="/dashboard/orders">
              <Button className="mt-4">Back to Orders</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { deployment, resources, recommendations } = botData
  const isRunning = resources?.status === 'running'

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Discord Bot</h1>
          <p className="text-muted-foreground">
            Guild ID: {deployment.discord_guild_id} • Tier: {deployment.tier}
          </p>
        </div>
        <Button onClick={fetchBotStatus} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Upgrade Recommendation */}
      {recommendations.upgrade && (
        <Card className="mb-8 border-orange-500">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-orange-500 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Upgrade Recommended</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {recommendations.reason}. Your bot might experience performance issues.
                </p>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Current Tier</p>
                    <Badge variant="outline" className="mt-1">{deployment.tier}</Badge>
                  </div>
                  <ArrowUpCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Suggested Tier</p>
                    <Badge className="mt-1">{recommendations.suggested_tier}</Badge>
                  </div>
                </div>
                <Link href="/pricing">
                  <Button className="mt-4 gap-2">
                    <TrendingUp className="h-4 w-4" />
                    View Upgrade Options
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bot Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Bot Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={isRunning ? 'default' : 'secondary'}>
                  {isRunning ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Running
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      {resources?.status || 'Offline'}
                    </>
                  )}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tier</span>
                <Badge variant="outline">{deployment.tier}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Provisioned</span>
                <span className="text-sm">
                  {new Date(deployment.provisioned_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Plan Limits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">RAM Allocated</span>
                <span className="text-sm font-medium">{resources?.limits.memory_mb}MB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">CPU Allocated</span>
                <span className="text-sm font-medium">{resources?.limits.cpu_percent}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Disk Space</span>
                <span className="text-sm font-medium">{Math.round(resources?.limits.disk_mb / 1024)}GB</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resource Usage */}
      {resources && isRunning && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Live Resource Usage</CardTitle>
            <CardDescription>
              Auto-refreshes every 10 seconds • Last updated: {new Date().toLocaleTimeString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* RAM Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">RAM Usage</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {resources.current.memory_mb}MB / {resources.limits.memory_mb}MB
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${
                      resources.utilization_percent.memory > 90 ? 'bg-red-500' :
                      resources.utilization_percent.memory > 80 ? 'bg-orange-500' :
                      resources.utilization_percent.memory > 60 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(resources.utilization_percent.memory, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {resources.utilization_percent.memory}% used
                  {resources.utilization_percent.memory > 80 && (
                    <span className="text-orange-600 ml-2">⚠️ High usage - consider upgrading</span>
                  )}
                </p>
              </div>

              {/* CPU Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">CPU Usage</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {resources.current.cpu_absolute.toFixed(1)}% / {resources.limits.cpu_percent}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${
                      resources.utilization_percent.cpu > 90 ? 'bg-red-500' :
                      resources.utilization_percent.cpu > 80 ? 'bg-orange-500' :
                      resources.utilization_percent.cpu > 60 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(resources.utilization_percent.cpu, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {resources.utilization_percent.cpu}% used
                  {resources.utilization_percent.cpu > 80 && (
                    <span className="text-orange-600 ml-2">⚠️ High usage - consider upgrading</span>
                  )}
                </p>
              </div>

              {/* Disk Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Disk Usage</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {resources.current.disk_mb}MB / {Math.round(resources.limits.disk_mb / 1024)}GB
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${
                      resources.utilization_percent.disk > 90 ? 'bg-red-500' :
                      resources.utilization_percent.disk > 80 ? 'bg-orange-500' :
                      resources.utilization_percent.disk > 60 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(resources.utilization_percent.disk, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {resources.utilization_percent.disk}% used
                  {resources.utilization_percent.disk > 80 && (
                    <span className="text-orange-600 ml-2">⚠️ Running out of space</span>
                  )}
                </p>
              </div>

              {/* Network Stats */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Network In</p>
                  <p className="text-sm font-medium">{resources.current.network_rx_mb}MB</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Network Out</p>
                  <p className="text-sm font-medium">{resources.current.network_tx_mb}MB</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bot Not Running */}
      {resources && !isRunning && (
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <XCircle className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">Bot is not running</h3>
                <p className="text-sm text-muted-foreground">
                  Your bot is currently offline. Go to the SparkedHost panel to start it.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => window.open(`https://control.sparkedhost.us/server/${deployment.pterodactyl_identifier}`, '_blank')}
                >
                  Open SparkedHost Panel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle>Enabled Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {deployment.features?.length > 0 ? (
              deployment.features.map((feature: string) => (
                <Badge key={feature} variant="outline">
                  {feature.replace(/_/g, ' ')}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No features listed</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="mt-8 flex gap-4">
        <Link href={`/dashboard/orders/${orderId}`}>
          <Button variant="outline">
            View Order Details
          </Button>
        </Link>
        <Link href="/contact">
          <Button variant="outline">
            Contact Support
          </Button>
        </Link>
        {recommendations.upgrade && (
          <Link href="/pricing">
            <Button className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Upgrade Plan
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}


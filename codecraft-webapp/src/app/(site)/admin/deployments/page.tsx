"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Server,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Rocket,
  AlertTriangle,
  Link as LinkIcon
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Link } from '@/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Deployment {
  id: string
  order_id: string
  discord_guild_id: string
  tier: string
  status: string
  health_status: string
  memory_mb: number
  cpu_percent: number
  disk_mb: number
  pterodactyl_server_id: string
  pterodactyl_identifier: string
  provisioned_at: string
  created_at: string
  orders: {
    id: string
    service_type: string
    users: {
      discord_tag: string
      avatar_url?: string
    }
  }
}

export default function AdminDeploymentsPage() {
  const { toast } = useToast()
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [readyOrders, setReadyOrders] = useState<any[]>([])
  const [existingServers, setExistingServers] = useState<any[]>([])
  const [loadingServers, setLoadingServers] = useState(false)
  const [resources, setResources] = useState<any>(null)
  const [loadingResources, setLoadingResources] = useState(false)
  
  // Link dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [selectedServer, setSelectedServer] = useState<any>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string>("")
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    fetchDeployments()
    fetchReadyOrders()
    fetchExistingServers()
    fetchResources()
    
    // Auto-refresh resources every 30 seconds
    const interval = setInterval(() => {
      fetchResources()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const fetchDeployments = async () => {
    try {
      const response = await fetch('/api/admin/deployments')
      const data = await response.json()

      if (response.ok) {
        setDeployments(data.deployments || [])
      }
    } catch (error) {
      console.error('Error fetching deployments:', error)
      toast({
        title: "Error",
        description: "Failed to load deployments",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchReadyOrders = async () => {
    try {
      // For auto-provisioning, use auto-provision endpoint
      const autoProvisionResponse = await fetch('/api/admin/deployments/auto-provision')
      const autoProvisionData = await autoProvisionResponse.json()

      // For linking, use linkable-orders endpoint (includes more orders)
      const linkableResponse = await fetch('/api/admin/deployments/linkable-orders')
      const linkableData = await linkableResponse.json()

      if (autoProvisionResponse.ok) {
        setReadyOrders(linkableData.orders || autoProvisionData.orders || [])
      }
    } catch (error) {
      console.error('Error fetching ready orders:', error)
    }
  }

  const fetchExistingServers = async () => {
    setLoadingServers(true)
    try {
      const response = await fetch('/api/admin/deployments/existing')
      const data = await response.json()

      if (response.ok) {
        setExistingServers(data.servers || [])
      }
    } catch (error) {
      console.error('Error fetching existing servers:', error)
    } finally {
      setLoadingServers(false)
    }
  }

  const fetchResources = async () => {
    setLoadingResources(true)
    try {
      const response = await fetch('/api/admin/deployments/resources')
      const data = await response.json()

      if (response.ok) {
        setResources(data)
      }
    } catch (error) {
      console.error('Error fetching resources:', error)
    } finally {
      setLoadingResources(false)
    }
  }

  const provisionBot = async (orderId: string) => {
    setActionLoading(orderId)
    try {
      const response = await fetch('/api/admin/deployments/auto-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to provision bot')
      }

      toast({
        title: "Success",
        description: "Bot provisioned successfully!"
      })

      fetchDeployments()
      fetchReadyOrders()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to provision bot",
        variant: "destructive"
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleAction = async (deploymentId: string, action: string) => {
    if (action === 'terminate' && !confirm('Are you sure? This will permanently delete the server!')) {
      return
    }

    setActionLoading(deploymentId)
    try {
      const response = await fetch(`/api/admin/deployments/${deploymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        throw new Error('Action failed')
      }

      toast({
        title: "Success",
        description: `Action '${action}' completed successfully`
      })

      fetchDeployments()
    } catch (error) {
      toast({
        title: "Error",
        description: "Action failed",
        variant: "destructive"
      })
    } finally {
      setActionLoading(null)
    }
  }

  const openLinkDialog = (server: any) => {
    setSelectedServer(server)
    setSelectedOrderId("")
    setLinkDialogOpen(true)
  }

  const handleLinkServer = async () => {
    if (!selectedServer || !selectedOrderId) {
      toast({
        title: "Missing Information",
        description: "Please select an order to link",
        variant: "destructive"
      })
      return
    }

    setLinking(true)
    try {
      const response = await fetch('/api/admin/deployments/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUuid: selectedServer.uuid || selectedServer.identifier,
          orderId: selectedOrderId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to link server')
      }

      toast({
        title: "Success! 🎉",
        description: data.message || 'Server linked to order successfully'
      })

      // Close dialog and refresh data
      setLinkDialogOpen(false)
      setSelectedServer(null)
      setSelectedOrderId("")
      fetchDeployments()
      fetchReadyOrders()
      fetchExistingServers()

    } catch (error) {
      console.error('Error linking server:', error)
      toast({
        title: "Error Linking Server",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      })
    } finally {
      setLinking(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any }> = {
      active: { variant: 'default', icon: CheckCircle },
      pending: { variant: 'secondary', icon: Clock },
      provisioning: { variant: 'secondary', icon: Loader2 },
      suspended: { variant: 'destructive', icon: Pause },
      failed: { variant: 'destructive', icon: XCircle },
      terminated: { variant: 'outline', icon: Trash2 }
    }

    const config = statusConfig[status] || statusConfig.pending
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    )
  }

  const activeDeployments = deployments.filter(d => d.status === 'active')
  const suspendedDeployments = deployments.filter(d => d.status === 'suspended')
  const failedDeployments = deployments.filter(d => d.status === 'failed')

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bot Deployments</h1>
          <p className="text-muted-foreground">Manage Discord bot servers</p>
        </div>
        <Button onClick={() => { fetchDeployments(); fetchReadyOrders(); fetchExistingServers(); }} disabled={loading || loadingServers} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${(loading || loadingServers) ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Resource Usage Overview */}
      {resources && resources.totals && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              SparkedHost Ultimate Resource Usage (Live)
            </CardTitle>
            <CardDescription>
              Auto-refreshes every 30 seconds • Last updated: {new Date().toLocaleTimeString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* RAM Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">RAM Usage</span>
                  <span className="text-sm text-muted-foreground">
                    {resources.totals.used.memory_limit_mb}MB / {resources.totals.plan_limits.memory_mb}MB
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${
                      resources.totals.utilization_percent.memory > 90 ? 'bg-red-500' :
                      resources.totals.utilization_percent.memory > 70 ? 'bg-orange-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(resources.totals.utilization_percent.memory, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {resources.totals.utilization_percent.memory}% used • {resources.totals.available.memory_mb}MB free
                </p>
              </div>

              {/* CPU Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">CPU Usage</span>
                  <span className="text-sm text-muted-foreground">
                    {resources.totals.used.cpu_limit_percent}% / {resources.totals.plan_limits.cpu_percent}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${
                      resources.totals.utilization_percent.cpu > 90 ? 'bg-red-500' :
                      resources.totals.utilization_percent.cpu > 70 ? 'bg-orange-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(resources.totals.utilization_percent.cpu, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {resources.totals.utilization_percent.cpu}% used • {resources.totals.available.cpu_percent}% free
                </p>
              </div>

              {/* Disk Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Disk Usage</span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(resources.totals.used.disk_limit_mb / 1024)}GB / {Math.round(resources.totals.plan_limits.disk_mb / 1024)}GB
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${
                      resources.totals.utilization_percent.disk > 90 ? 'bg-red-500' :
                      resources.totals.utilization_percent.disk > 70 ? 'bg-orange-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(resources.totals.utilization_percent.disk, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {resources.totals.utilization_percent.disk}% used • {Math.round(resources.totals.available.disk_mb / 1024)}GB free
                </p>
              </div>
            </div>

            {/* Warning if capacity high */}
            {resources.totals.utilization_percent.memory > 85 && (
              <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-sm font-medium">
                    RAM capacity at {resources.totals.utilization_percent.memory}% - Consider upgrading or removing unused bots
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Sub-Servers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{existingServers.length}</div>
            <p className="text-xs text-muted-foreground">Max 13 on Ultimate plan</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-600">Running</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {resources?.servers?.filter((s: any) => s.status === 'running').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-orange-600">Stopped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {resources?.servers?.filter((s: any) => s.status === 'offline').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-600">Linked to Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {existingServers.filter(s => s.isLinked).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ready to Deploy */}
      {readyOrders.length > 0 && (
        <Card className="mb-8 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Ready to Deploy ({readyOrders.length})
            </CardTitle>
            <CardDescription>
              These orders are paid and ready for bot provisioning
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {readyOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-semibold">{order.users?.discord_tag || 'Unknown User'}</p>
                    <p className="text-sm text-muted-foreground">
                      Order #{order.id.substring(0, 8)} • {order.tier} • Guild: {order.discord_guild_id}
                    </p>
                  </div>
                  <Button
                    onClick={() => provisionBot(order.id)}
                    disabled={actionLoading === order.id}
                    className="gap-2"
                  >
                    {actionLoading === order.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Provisioning...
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4" />
                        Provision Bot
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Sub-Servers from SparkedHost */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Existing Sub-Servers in Osrsbay ({existingServers.length})
          </CardTitle>
          <CardDescription>
            All sub-servers under your main SparkedHost server (Driver, bayboosts, Sina's bday, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingServers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : existingServers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No sub-servers found or API not configured</p>
              <p className="text-sm">Set PTERODACTYL_PARENT_SERVER_UUID to see sub-servers</p>
            </div>
          ) : (
            <div className="space-y-3">
              {existingServers.map((server) => {
                const resourceData = resources?.servers?.find((r: any) => r.uuid === (server.uuid || server.identifier))
                const isRunning = resourceData?.status === 'running'
                
                return (
                  <div key={server.uuid || server.identifier} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-semibold">{server.name}</p>
                        {server.isLinked ? (
                          <Badge variant="default">Linked to Order</Badge>
                        ) : (
                          <Badge variant="outline">Unlinked (Manual)</Badge>
                        )}
                        {resourceData && (
                          <Badge variant={isRunning ? 'default' : 'secondary'}>
                            {resourceData.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        UUID: {server.uuid || server.identifier}
                      </p>
                      {server.limits && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Allocated: {server.limits.memory}MB RAM, {server.limits.cpu}% CPU, {Math.round(server.limits.disk / 1024)}GB Disk
                        </p>
                      )}
                      {resourceData?.resources && isRunning && (
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <div className="text-xs">
                            <span className="text-muted-foreground">RAM:</span>
                            <span className="ml-1 font-medium">{resourceData.resources.memory_mb}MB</span>
                          </div>
                          <div className="text-xs">
                            <span className="text-muted-foreground">CPU:</span>
                            <span className="ml-1 font-medium">{resourceData.resources.cpu_absolute.toFixed(1)}%</span>
                          </div>
                          <div className="text-xs">
                            <span className="text-muted-foreground">Disk:</span>
                            <span className="ml-1 font-medium">{resourceData.resources.disk_mb}MB</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {server.isLinked && server.deployment ? (
                        <Link href={`/admin/orders/${server.deployment.order_id}`}>
                          <Button variant="outline" size="sm">
                            View Order
                          </Button>
                        </Link>
                      ) : (
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="gap-2"
                          onClick={() => openLinkDialog(server)}
                        >
                          <LinkIcon className="h-4 w-4" />
                          Link to Order
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deployments List */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">
            All ({deployments.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({activeDeployments.length})
          </TabsTrigger>
          <TabsTrigger value="suspended">
            Suspended ({suspendedDeployments.length})
          </TabsTrigger>
          <TabsTrigger value="failed">
            Failed ({failedDeployments.length})
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <TabsContent value="all" className="space-y-4">
              <DeploymentsList deployments={deployments} onAction={handleAction} actionLoading={actionLoading} getStatusBadge={getStatusBadge} />
            </TabsContent>
            <TabsContent value="active" className="space-y-4">
              <DeploymentsList deployments={activeDeployments} onAction={handleAction} actionLoading={actionLoading} getStatusBadge={getStatusBadge} />
            </TabsContent>
            <TabsContent value="suspended" className="space-y-4">
              <DeploymentsList deployments={suspendedDeployments} onAction={handleAction} actionLoading={actionLoading} getStatusBadge={getStatusBadge} />
            </TabsContent>
            <TabsContent value="failed" className="space-y-4">
              <DeploymentsList deployments={failedDeployments} onAction={handleAction} actionLoading={actionLoading} getStatusBadge={getStatusBadge} />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Link Server to Order Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Server to Order</DialogTitle>
            <DialogDescription>
              Connect <strong>{selectedServer?.name}</strong> to an existing order. This will track resources and allow customers to manage their bot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Server UUID</label>
              <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
                {selectedServer?.uuid || selectedServer?.identifier}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Order</label>
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an order..." />
                </SelectTrigger>
                <SelectContent>
                  {readyOrders.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No orders available
                    </div>
                  ) : (
                    readyOrders.map((order: any) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.order_number} - {order.service_name || order.service_type} ({order.users?.discord_tag})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Showing all paid orders without a linked server (includes orphaned deployments)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLinkDialogOpen(false)}
              disabled={linking}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLinkServer}
              disabled={!selectedOrderId || linking}
              className="gap-2"
            >
              {linking && <Loader2 className="h-4 w-4 animate-spin" />}
              Link Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DeploymentsList({ 
  deployments, 
  onAction, 
  actionLoading, 
  getStatusBadge 
}: { 
  deployments: Deployment[]
  onAction: (id: string, action: string) => void
  actionLoading: string | null
  getStatusBadge: (status: string) => JSX.Element
}) {
  if (deployments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <Server className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No deployments found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {deployments.map((deployment) => (
        <Card key={deployment.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-lg">
                    {deployment.orders?.users?.discord_tag || 'Unknown User'}
                  </h3>
                  {getStatusBadge(deployment.status)}
                  <Badge variant="outline">{deployment.tier}</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-4">
                  <div>
                    <p><strong>Guild ID:</strong> {deployment.discord_guild_id}</p>
                    <p><strong>Server ID:</strong> {deployment.pterodactyl_identifier || 'N/A'}</p>
                  </div>
                  <div>
                    <p><strong>Resources:</strong> {deployment.memory_mb}MB RAM, {deployment.cpu_percent}% CPU</p>
                    <p><strong>Provisioned:</strong> {deployment.provisioned_at ? new Date(deployment.provisioned_at).toLocaleString() : 'Not yet'}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link href={`/admin/orders/${deployment.order_id}`}>
                    <Button variant="outline" size="sm">
                      View Order
                    </Button>
                  </Link>
                  
                  {deployment.status === 'active' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAction(deployment.id, 'suspend')}
                      disabled={actionLoading === deployment.id}
                      className="gap-2"
                    >
                      <Pause className="h-3 w-3" />
                      Suspend
                    </Button>
                  )}

                  {deployment.status === 'suspended' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAction(deployment.id, 'unsuspend')}
                      disabled={actionLoading === deployment.id}
                      className="gap-2"
                    >
                      <Play className="h-3 w-3" />
                      Unsuspend
                    </Button>
                  )}

                  {(deployment.status === 'failed' || deployment.status === 'suspended') && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onAction(deployment.id, 'terminate')}
                      disabled={actionLoading === deployment.id}
                      className="gap-2"
                    >
                      <Trash2 className="h-3 w-3" />
                      Terminate
                    </Button>
                  )}

                  {actionLoading === deployment.id && (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  )
}


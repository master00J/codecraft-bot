// Pterodactyl Panel API Client
// Docs: https://dashflo.net/docs/api/pterodactyl/v1/

import { PTERODACTYL_CONFIG } from './tier-config'

interface PterodactylConfig {
  panelUrl: string
  apiKey: string
}

// SparkedHost Splitter API format (for sub-servers)
interface ServerCreateOptions {
  name: string
  cpu: number // Integer (50 = 50%)
  memory: number // Integer MB
  disk: number // Integer MB
  egg_id: number // Egg ID
  copy_subusers: boolean // Copy parent subusers
  localhost_networking: boolean // Enable localhost networking
  environment?: Record<string, string> // Environment variables for Application API
}

interface ServerDetails {
  id: number
  identifier: string
  uuid: string
  name: string
  description: string
  status: string | null
  limits: {
    memory: number
    swap: number
    disk: number
    io: number
    cpu: number
  }
  feature_limits: {
    databases: number
    allocations: number
    backups: number
  }
}

interface ServerResourceUsage {
  current_state: string
  is_suspended: boolean
  resources: {
    memory_bytes: number
    cpu_absolute: number
    disk_bytes: number
    network_rx_bytes: number
    network_tx_bytes: number
  }
}

export class PterodactylClient {
  private config: PterodactylConfig

  constructor(config?: PterodactylConfig) {
    this.config = config || {
      panelUrl: process.env.PTERODACTYL_PANEL_URL || '',
      apiKey: process.env.PTERODACTYL_API_KEY || ''
    }

    if (!this.config.panelUrl || !this.config.apiKey) {
      console.error('⚠️ Pterodactyl credentials not configured!')
    }
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    apiType: 'client' | 'application' = 'client'
  ): Promise<T> {
    // Remove trailing slash from panelUrl to avoid double slashes
    const baseUrl = this.config.panelUrl.replace(/\/$/, '')
    const url = `${baseUrl}/api/${apiType}${endpoint}`
    
    // Log for debugging
    if (endpoint.includes('splitter')) {
      console.log(`🔍 API Request: ${options.method || 'GET'} ${url}`)
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers
        }
      })

      if (!response.ok) {
        const error = await response.text()
        const errorInfo = {
          status: response.status,
          endpoint,
          error
        }
        
        // For 404 errors, create a special error that can be caught gracefully
        if (response.status === 404) {
          const notFoundError: any = new Error(`Pterodactyl API Error: 404 - ${error}`)
          notFoundError.status = 404
          notFoundError.isNotFound = true
          console.log('ℹ️  Resource not found (404):', endpoint)
          throw notFoundError
        }
        
        console.error('Pterodactyl API Error:', errorInfo)
        throw new Error(`Pterodactyl API Error: ${response.status} - ${error}`)
      }

      // Handle empty responses (204 No Content or empty body)
      const contentType = response.headers.get('content-type') || ''
      const contentLength = response.headers.get('content-length')
      
      // If 204 No Content or no content-length/empty, return empty object
      if (response.status === 204 || contentLength === '0' || !contentType.includes('application/json')) {
        return {} as T
      }

      // Try to parse JSON, but handle empty responses gracefully
      const text = await response.text()
      if (!text || text.trim() === '') {
        // Empty response is OK for file operations, power actions, etc.
        return {} as T
      }

      try {
        return JSON.parse(text) as T
      } catch (parseError) {
        // If JSON parse fails but response was OK, it might be an empty success response
        if (response.ok && (endpoint.includes('/files/') || endpoint.includes('/power') || endpoint.includes('/startup'))) {
          console.log(`ℹ️  Empty response for ${endpoint} (assuming success)`)
          return {} as T
        }
        console.warn(`⚠️  Could not parse JSON response for ${endpoint}:`, parseError)
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`)
      }
    } catch (error) {
      console.error('Pterodactyl request failed:', error)
      throw error
    }
  }

  // Create a new server (Discord bot)
  // Supports both Splitter API (SparkedHost) and Application API (Standard Pterodactyl)
  async createServer(options: ServerCreateOptions): Promise<ServerDetails> {
    const apiMode = PTERODACTYL_CONFIG.API_MODE || 'splitter'
    
    console.log(`🔍 Creating server using ${apiMode} API mode`)
    console.log(`📋 Options:`, JSON.stringify(options, null, 2))
    
    if (apiMode === 'splitter') {
      // Splitter API (SparkedHost) - Create sub-server under parent
      const parentUuid = PTERODACTYL_CONFIG.PARENT_SERVER_UUID
      
      if (!parentUuid) {
        throw new Error('PTERODACTYL_PARENT_SERVER_UUID not configured! Required for Splitter API mode.')
      }
      
      console.log(`🔍 Attempting to create sub-server under parent: ${parentUuid}`)
      
      try {
        const response = await this.request<{ attributes: ServerDetails }>(
          `/servers/${parentUuid}/splitter`, 
          {
            method: 'POST',
            body: JSON.stringify(options)
          },
          'client' // Use Client API
        )

        console.log('✅ Sub-server created via Splitter API:', response.attributes.identifier)
        return response.attributes
      } catch (error: any) {
        if (error.message?.includes('404') || error.message?.includes('NotFound')) {
          throw new Error(`Splitter API not available. The endpoint /servers/${parentUuid}/splitter returned 404. This might mean:
1. The Splitter API is not enabled on this Pterodactyl installation
2. The parent server UUID is incorrect: ${parentUuid}
3. The API key doesn't have access to create sub-servers

Please verify:
- Parent server UUID is correct: ${parentUuid}
- Splitter API is enabled in Pterodactyl
- API key has proper permissions`)
        }
        throw error
      }
    } else {
      // Application API (Standard Pterodactyl) - Create standalone server
      const nodeId = PTERODACTYL_CONFIG.DEFAULT_NODE_ID
      const nestId = PTERODACTYL_CONFIG.DEFAULT_NEST_ID
      const eggId = PTERODACTYL_CONFIG.DEFAULT_EGG_ID
      const userId = PTERODACTYL_CONFIG.DEFAULT_USER_ID
      
      if (!nodeId || !nestId || !eggId || !userId) {
        throw new Error('Pterodactyl configuration incomplete for Application API mode. Required: DEFAULT_NODE_ID, DEFAULT_NEST_ID, DEFAULT_EGG_ID, DEFAULT_USER_ID')
      }
      
      console.log(`🔍 Creating standalone server on node ${nodeId}`)
      
      // Try to get an available allocation (port)
      // If this fails, we'll create the server without specifying an allocation
      // and let Pterodactyl automatically assign one
      let allocationId: number | null = null
      
      try {
        const allocationsResponse = await this.request<{ data: Array<{ attributes: { id: number; ip: string; port: number; assigned: boolean } }> }>(
          `/nodes/${nodeId}/allocations`,
          { method: 'GET' },
          'application'
        )
        
        const availableAllocation = allocationsResponse.data?.find(
          (alloc: any) => !alloc.attributes.assigned
        )
        
        if (availableAllocation) {
          allocationId = availableAllocation.attributes.id
          console.log(`✅ Found available allocation: ${availableAllocation.attributes.ip}:${availableAllocation.attributes.port} (ID: ${allocationId})`)
        } else {
          console.warn(`⚠️  No available allocations found on node ${nodeId}, will let Pterodactyl auto-assign`)
        }
      } catch (allocError: any) {
        // If we can't fetch allocations (permission issue or endpoint not available),
        // we'll create the server without specifying an allocation
        // Pterodactyl will automatically assign an available allocation
        console.warn(`⚠️  Could not fetch allocations (${allocError.message}), will let Pterodactyl auto-assign`)
      }
      
      // Create server using Application API
      // Note: Pterodactyl Application API expects 'user' and 'egg' (not 'user_id' and 'egg_id')
      // Environment variables must be provided here because they are required by the egg
      const serverData: any = {
        name: options.name,
        user: userId, // Application API expects 'user', not 'user_id'
        egg: eggId,   // Application API expects 'egg', not 'egg_id'
        docker_image: PTERODACTYL_CONFIG.DOCKER_IMAGE,
        startup: PTERODACTYL_CONFIG.STARTUP_COMMAND,
        environment: {
          NODE_ENV: 'production',
          // Include environment variables from options (required by egg)
          ...options.environment
        },
        limits: {
          memory: options.memory,
          swap: 0,
          disk: options.disk,
          io: 500,
          cpu: options.cpu
        },
        feature_limits: {
          databases: 0,
          allocations: 1,
          backups: 1
        },
        deploy: {
          locations: [nodeId],
          dedicated_ip: false,
          port_range: []
        }
      }
      
      // Only specify allocation if we found one, otherwise let Pterodactyl auto-assign
      if (allocationId) {
        serverData.allocation = {
          default: allocationId
        }
      } else {
        console.log(`ℹ️  Creating server without specific allocation - Pterodactyl will auto-assign`)
      }
      
      try {
        console.log(`📤 Creating server via Application API: POST /api/application/servers`)
        console.log(`   Panel URL: ${this.config.panelUrl}`)
        console.log(`   API Key: ${this.config.apiKey ? `${this.config.apiKey.substring(0, 10)}...` : 'MISSING'}`)
        
        const response = await this.request<{ attributes: ServerDetails } | { data: { attributes: ServerDetails } }>(
          '/servers',
          {
            method: 'POST',
            body: JSON.stringify(serverData)
          },
          'application' // Use Application API
        )

        // Handle both response formats: { attributes } or { data: { attributes } }
        const serverDetails = 'data' in response ? response.data.attributes : response.attributes
        
        console.log('✅ Server created via Application API:', serverDetails.identifier)
        return serverDetails
      } catch (error: any) {
        console.error('❌ Failed to create server via Application API:', error)
        
        // Provide helpful error message for 404 on /servers endpoint
        if (error.message?.includes('404') && error.message?.includes('/servers')) {
          throw new Error(`Failed to create server: The Application API endpoint /api/application/servers returned 404. This usually means:
1. Your API key is not an Application API key (it might be a Client API key)
2. Your API key doesn't have 'servers.*' permissions
3. The API key is invalid or expired

Please check:
- Go to Pterodactyl Panel → Account Settings → API Credentials
- Make sure you're using an "Application API" key (not Client API)
- Ensure it has these permissions: servers.*, nodes.*, allocations.*, users.*
- Regenerate the key if needed and update PTERODACTYL_API_KEY in Vercel`)
        }
        
        throw new Error(`Failed to create server: ${error.message}`)
      }
    }
  }

  // Get server details by UUID (using Application API)
  async getServer(serverUuid: string): Promise<any> {
    try {
      const response = await this.request<any>(
        `/servers/${serverUuid}`,
        {},
        'application' // Use Application API, not Client API
      )
      // Handle both response formats: { attributes } or { data: { attributes } }
      return 'data' in response ? response.data.attributes : response.attributes
    } catch (error: any) {
      // Fallback: try without specifying API mode (might default correctly)
      const response = await this.request<any>(
        `/servers/${serverUuid}`
      )
      return 'data' in response ? response.data.attributes : response.attributes
    }
  }

  // Wait for server installation to complete
  async waitForServerReady(serverUuid: string, maxWaitTime: number = 120000): Promise<void> {
    const startTime = Date.now()
    const checkInterval = 5000 // Check every 5 seconds
    
    console.log(`⏳ Waiting for server ${serverUuid} installation to complete...`)
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const server = await this.getServer(serverUuid)
        
        // Check if server is installed (not in installing state)
        if (server.status !== 'installing' && server.status !== 'install_failed') {
          console.log(`✅ Server installation complete! Status: ${server.status}`)
          return
        }
        
        console.log(`⏳ Server still installing... (${Math.floor((Date.now() - startTime) / 1000)}s elapsed)`)
        await new Promise(resolve => setTimeout(resolve, checkInterval))
      } catch (error: any) {
        // If we get a 404, server might not exist yet or API access issue
        if (error?.isNotFound || error?.status === 404) {
          console.log(`⏳ Server not found yet (might still be creating)... (${Math.floor((Date.now() - startTime) / 1000)}s elapsed)`)
          await new Promise(resolve => setTimeout(resolve, checkInterval))
          continue
        }
        // If we get a 403, API access issue - but we can still proceed
        if (error?.status === 403) {
          console.log(`⚠️  Cannot check server status via API (403) - assuming installation will complete`)
          console.log(`ℹ️  Proceeding without status check...`)
          return // Don't block - server might still be installing but we can't check
        }
        // If we get a 409 error, server is still installing
        if (error.message?.includes('409') || error.message?.includes('installation')) {
          console.log(`⏳ Server still installing... (${Math.floor((Date.now() - startTime) / 1000)}s elapsed)`)
          await new Promise(resolve => setTimeout(resolve, checkInterval))
          continue
        }
        // For other errors, log but don't throw - we'll try a few more times
        console.warn(`⚠️  Error checking server status:`, error.message)
        await new Promise(resolve => setTimeout(resolve, checkInterval))
        continue
      }
    }
    
    console.warn(`⚠️  Server installation check timeout after ${maxWaitTime / 1000}s`)
    console.log(`ℹ️  Proceeding anyway - server might still be installing`)
    // Don't throw - allow process to continue
  }

  // Update server resources - Using Dedicated API
  async updateServerResources(
    serverUuid: string,
    limits: {
      memory?: number
      cpu?: number
      disk?: number
      swap?: number
      io?: number
    }
  ): Promise<any> {
    // SparkedHost might not allow resource updates via API
    // This would need to be done via their billing/upgrade system
    console.warn('⚠️ Resource updates may need to be done via SparkedHost billing')
    
    // Attempt update (might fail on SparkedHost)
    try {
      const response = await this.request<any>(
        `/servers/${serverUuid}/settings/details`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: `Updated Bot ${serverUuid}`
          })
        }
      )
      return response
    } catch (error) {
      console.error('Resource update not available via API')
      throw error
    }
  }

  // Suspend server - Not available in Client API, need to use power stop
  async suspendServer(serverUuid: string): Promise<void> {
    await this.sendPowerAction(serverUuid, 'stop')
    console.log('⏸️  Server stopped (suspended):', serverUuid)
  }

  // Unsuspend server - Start the server
  async unsuspendServer(serverUuid: string): Promise<void> {
    await this.sendPowerAction(serverUuid, 'start')
    console.log('▶️  Server started (unsuspended):', serverUuid)
  }

  // Delete server - Supports both Splitter API and Application API
  async deleteServer(serverUuid: string): Promise<void> {
    const apiMode = PTERODACTYL_CONFIG.API_MODE || 'splitter'
    
    try {
      if (apiMode === 'splitter') {
        // Splitter API - Delete sub-server
        const parentUuid = PTERODACTYL_CONFIG.PARENT_SERVER_UUID
        
        if (!parentUuid) {
          throw new Error('PTERODACTYL_PARENT_SERVER_UUID not configured!')
        }
        
        await this.request(`/servers/${parentUuid}/splitter/${serverUuid}`, {
          method: 'DELETE'
        }, 'client')
        console.log('🗑️  Sub-server deleted:', serverUuid)
      } else {
        // Application API - Delete standalone server
        await this.request(`/servers/${serverUuid}`, {
          method: 'DELETE'
        }, 'application')
        console.log('🗑️  Server deleted:', serverUuid)
      }
    } catch (error: any) {
      // 404 means server doesn't exist (already deleted), which is fine
      if (error?.isNotFound || error?.status === 404 || error?.message?.includes('404') || error?.message?.includes('NotFound')) {
        console.log(`ℹ️  Server ${serverUuid} already deleted or doesn't exist`)
        return // Success - server is already gone
      }
      // Re-throw other errors
      throw error
    }
  }

  // Get server resource usage (via Application API)
  async getServerResources(serverUuid: string): Promise<ServerResourceUsage> {
    try {
      const response = await this.request<any>(
        `/servers/${serverUuid}/resources`,
        {},
        'application' // Use Application API
      )
      // Handle both response formats: { attributes } or { data: { attributes } }
      return 'data' in response ? response.data.attributes : response.attributes
    } catch (error: any) {
      // Fallback: try without specifying API mode (might default correctly)
      const response = await this.request<any>(
        `/servers/${serverUuid}/resources`
      )
      return 'data' in response ? response.data.attributes : response.attributes
    }
  }

  // Send console command to server (Client API)
  async sendCommand(serverUuid: string, command: string): Promise<void> {
    try {
      await this.request(
        `/servers/${serverUuid}/command`,
        {
          method: 'POST',
          body: JSON.stringify({ command })
        },
        'client'
      )
      console.log(`📝 Command sent to ${serverUuid}: ${command}`)
    } catch (error: any) {
      // Handle 502 - server might be offline
      if (error.message?.includes('502') || error.message?.includes('offline')) {
        console.log(`ℹ️  Server ${serverUuid} is offline, command not sent`)
        return
      }
      throw error
    }
  }

  // Send power command (Client API)
  async sendPowerAction(
    serverUuid: string,
    action: 'start' | 'stop' | 'restart' | 'kill'
  ): Promise<void> {
    try {
      const response = await this.request(
        `/servers/${serverUuid}/power`,
        {
          method: 'POST',
          body: JSON.stringify({ signal: action })
        },
        'client'
      )

      console.log(`🔌 Power action sent: ${action} for ${serverUuid}`)
    } catch (error: any) {
      // Handle 404 - server doesn't exist (already deleted)
      if (error?.isNotFound || error?.status === 404 || error.message?.includes('404') || error.message?.includes('NotFound')) {
        console.log(`ℹ️  Server ${serverUuid} doesn't exist (may already be deleted)`)
        return // Success - server is already gone
      }
      
      // Handle empty response or JSON parse errors
      if (error.message?.includes('JSON') || error.message?.includes('Unexpected end')) {
        // Sometimes power actions return empty response but succeed
        console.log(`🔌 Power action ${action} sent (empty response, assuming success)`)
        return
      }
      throw error
    }
  }

  // Set environment variable on server (Client API)
  async setEnvironmentVariable(
    serverUuid: string,
    variableName: string,
    value: string,
    retries: number = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // First, get the current startup variables
        const startup = await this.request<any>(
          `/servers/${serverUuid}/startup`
        )

        // Find the variable in the startup data
        const variables = startup.meta?.startup_variables || []
        const variable = variables.find((v: any) => 
          v.env_variable === variableName || v.name === variableName
        )

        if (!variable) {
          console.warn(`⚠️  Variable ${variableName} not found in egg configuration`)
          console.log(`ℹ️  This variable needs to be added to the Pterodactyl egg configuration`)
          console.log(`ℹ️  For now, it will be written to .env file instead`)
          // Don't return - we'll write to .env file as fallback
          throw new Error(`Variable ${variableName} not in egg config - will use .env file`)
        }

        // Update the variable value
        await this.request(
          `/servers/${serverUuid}/startup/variable`,
          {
            method: 'PUT',
            body: JSON.stringify({
              key: variable.env_variable || variableName,
              value: value
            })
          }
        )

        console.log(`✅ Set environment variable ${variableName} on server ${serverUuid}`)
        return
      } catch (error: any) {
        // If server is still installing (409), wait and retry
        if (error.message?.includes('409') || error.message?.includes('installation')) {
          if (attempt < retries) {
            const waitTime = attempt * 5000 // 5s, 10s, 15s
            console.log(`⏳ Server still installing, waiting ${waitTime / 1000}s before retry ${attempt + 1}/${retries}...`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }
        }
        throw error
      }
    }
  }

  // Get available eggs for a specific server
  async getServerEggs(serverUuid: string): Promise<any[]> {
    try {
      const response = await this.request<any>(
        `/servers/${serverUuid}/settings/eggs`,
        {},
        'client'
      )
      return response.data || []
    } catch (error: any) {
      console.warn(`⚠️  Could not get available eggs for server:`, error.message)
      return []
    }
  }

  // Get current startup command from server
  async getStartupCommand(serverUuid: string): Promise<string | null> {
    try {
      const response = await this.request<any>(
        `/servers/${serverUuid}/startup`,
        {},
        'client'
      )
      return response.startup || null
    } catch (error: any) {
      console.warn(`⚠️  Could not get startup command:`, error.message)
      return null
    }
  }

  // Set startup command for server
  async setStartupCommand(serverUuid: string, command: string): Promise<void> {
    try {
      // Try Application API first (PUT /api/application/servers/{uuid}/startup)
      // Get current startup data first
      const startup = await this.request<any>(
        `/servers/${serverUuid}/startup`,
        {},
        'application'
      ).catch(() => null)
      
      if (startup) {
        // Update via Application API
        await this.request(
          `/servers/${serverUuid}/startup`,
          {
            method: 'PUT',
            body: JSON.stringify({
              startup: command,
              ...(startup.meta || {}),
              ...(startup.startup_variables || [])
            })
          },
          'application'
        )
        console.log(`✅ Startup command set via Application API: ${command}`)
        return
      }
    } catch (appError: any) {
      console.log(`⚠️  Application API method failed, trying Client API fallback...`)
    }
    
    // Fallback to Client API (if we have client API key or server user token)
    try {
      await this.request(
        `/servers/${serverUuid}/startup/command`,
        {
          method: 'PUT',
          body: JSON.stringify({
            value: command
          })
        },
        'client'
      )
      console.log(`✅ Startup command set via Client API: ${command}`)
    } catch (error: any) {
      // SparkedHost and some other providers block startup command changes via API
      if (error?.status === 400 && error?.message?.includes('support team')) {
        console.log(`ℹ️  Startup command cannot be changed via API (host restriction)`)
        console.log(`ℹ️  Please set startup command manually in Pterodactyl panel to: ${command}`)
        console.log(`ℹ️  Or use the start.sh script which handles deployment automatically`)
      } else if (error?.status === 403) {
        console.log(`ℹ️  Startup command cannot be changed via API (no Client API access)`)
        console.log(`ℹ️  Please set startup command manually in Pterodactyl panel to: ${command}`)
        console.log(`ℹ️  Location: Panel → Server → Startup → Startup Command`)
      } else {
        console.warn(`⚠️  Could not set startup command via API:`, error.message)
        console.log(`ℹ️  Please set startup command manually in Pterodactyl panel to: ${command}`)
      }
      // Don't throw - continue with other operations
    }
  }

  // Create directory structure if it doesn't exist
  async ensureDirectoryExists(serverUuid: string, directory: string): Promise<void> {
    if (!directory || directory === '/' || directory === '') {
      return // Root directory always exists
    }
    
    try {
      // Try to create directory using Pterodactyl API
      // Note: Pterodactyl might auto-create directories on upload, but we'll try to create them explicitly
      // The directory path should be relative to /home/container (no leading slash)
      const cleanDirectory = directory.startsWith('/') ? directory.substring(1) : directory
      
      await this.request(
        `/servers/${serverUuid}/files/create-folder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            root: '/home/container',
            name: cleanDirectory
          })
        },
        'client'
      )
      console.log(`   📁 Created directory: ${cleanDirectory}`)
    } catch (error: any) {
      // Directory might already exist or API might not support this
      // That's okay - we'll try to upload anyway
      if (!error.message?.includes('already exists') && !error.message?.includes('409')) {
        console.log(`   ℹ️  Could not create directory ${directory} (may already exist or auto-created):`, error.message)
      }
    }
  }

  // Upload file content to server via File API using signed upload URL
  // This method correctly handles file content (not JSON request body)
  async uploadFile(serverUuid: string, filePath: string, content: string): Promise<void> {
    try {
      const contentBuffer = Buffer.from(content, 'utf8')
      
      // Parse file path to get directory and filename
      const directory = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '/'
      const fileName = filePath.includes('/') ? filePath.substring(filePath.lastIndexOf('/') + 1) : filePath
      
      // Normalize directory path (relative to /home/container, no leading slash)
      const normalizedDirectory = directory === '/' ? '' : directory.startsWith('/') ? directory.substring(1) : directory
      
      // Create parent directories recursively if needed
      if (normalizedDirectory) {
        const dirParts = normalizedDirectory.split('/')
        let currentPath = ''
        for (const part of dirParts) {
          currentPath = currentPath ? `${currentPath}/${part}` : part
          await this.ensureDirectoryExists(serverUuid, currentPath)
        }
      }
      
      console.log(`📤 Uploading file ${filePath} to server ${serverUuid}...`)
      console.log(`   Directory: "${normalizedDirectory}" (empty for root), File: ${fileName}`)
      
      // Step 1: Get signed upload URL with directory parameter
      const uploadUrlResponse = await this.request<{ attributes: { url: string } }>(
        `/servers/${serverUuid}/files/upload${normalizedDirectory ? `?directory=${encodeURIComponent(normalizedDirectory)}` : ''}`,
        {
          method: 'GET'
        },
        'client'
      )
      
      if (!uploadUrlResponse?.attributes?.url) {
        throw new Error('Failed to get signed upload URL - response missing url attribute')
      }
      
      const signedUrl = uploadUrlResponse.attributes.url
      console.log(`   Got signed URL (directory: "${normalizedDirectory}")`)
      
      // Step 2: Upload file to signed URL using multipart form data
      // IMPORTANT: Do NOT include directory in form data - only in signed URL query parameter
      const boundary = `----WebKitFormBoundary${Date.now()}`
      const formDataParts: Buffer[] = []
      
      const addString = (str: string) => formDataParts.push(Buffer.from(str, 'utf8'))
      const addNewline = () => formDataParts.push(Buffer.from('\r\n', 'utf8'))
      
      // Add file field only - directory is already specified in signed URL
      addString(`--${boundary}`)
      addNewline()
      addString(`Content-Disposition: form-data; name="files"; filename="${fileName}"`)
      addNewline()
      addString(`Content-Type: text/plain`)
      addNewline()
      addNewline()
      formDataParts.push(Buffer.from(content, 'utf8'))  // Plain text content, not base64
      addNewline()
      
      // Close boundary
      addString(`--${boundary}--`)
      addNewline()
      
      const formDataBody = Buffer.concat(formDataParts)
      
      const uploadResponse = await fetch(signedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': formDataBody.length.toString()
        },
        body: formDataBody
      })
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`)
      }
      
      console.log(`✅ File uploaded: ${filePath} (${contentBuffer.length} bytes)`)
    } catch (error: any) {
      console.error(`❌ Failed to upload file ${filePath}:`, error.message)
      throw error
    }
  }

  // Download file from URL and upload to server
  async downloadAndUploadFile(serverUuid: string, filePath: string, url: string, githubToken?: string): Promise<void> {
    try {
      console.log(`📥 Downloading ${url} and uploading to ${filePath}...`)
      
      // Download file from URL (with GitHub token if provided for private repos)
      const headers: HeadersInit = {}
      if (githubToken && url.includes('github.com') || url.includes('raw.githubusercontent.com')) {
        headers['Authorization'] = `token ${githubToken}`
      }
      
      const response = await fetch(url, { headers })
      if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.statusText} (${response.status})`)
      }
      
      const content = await response.text()
      
      // Upload to server
      await this.uploadFile(serverUuid, filePath, content)
      console.log(`✅ File downloaded and uploaded: ${filePath}`)
    } catch (error: any) {
      console.warn(`⚠️  Could not download and upload file ${filePath}:`, error.message)
      throw error
    }
  }

  // Deploy bot files directly from GitHub (downloads and uploads files immediately)
  async deployBotFilesDirectly(serverUuid: string, repoUrl: string = 'https://github.com/master00J/codecraft-solutions', branch: string = 'main', githubToken?: string): Promise<void> {
    try {
      console.log(`📦 Deploying bot files directly from GitHub to server ${serverUuid}...`)
      
      // Build raw GitHub URLs
      const repoPath = repoUrl.replace('https://github.com/', '').replace('.git', '').replace('http://github.com/', '')
      const baseUrl = `https://raw.githubusercontent.com/${repoPath}/${branch}`
      
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3.raw'
      }
      if (githubToken) {
        headers['Authorization'] = `token ${githubToken}`
      }
      
      // 1. Download and upload index.js
      console.log(`📥 Downloading index.js...`)
      console.log(`   Server UUID: ${serverUuid}`)
      console.log(`   GitHub URL: ${baseUrl}/index.js`)
      try {
        const botFileUrl = `${baseUrl}/index.js`
        const botResponse = await fetch(botFileUrl, { headers })
        if (botResponse.ok) {
          const botContent = await botResponse.text()
          
          // Verify content is correct (should start with comment or const/require)
          if (!botContent || botContent.length < 100) {
            throw new Error(`Downloaded content is too short or empty (${botContent.length} bytes)`)
          }
          
          // Check if content looks like the bot file (should have COMCRAFT or discord.js)
          if (!botContent.includes('COMCRAFT') && !botContent.includes('discord.js') && !botContent.includes('require')) {
            console.warn(`⚠️  Downloaded content doesn't look like index.js. First 200 chars: ${botContent.substring(0, 200)}`)
          }
          
          console.log(`   Downloaded ${botContent.length} bytes, uploading to server ${serverUuid}...`)
          await this.uploadFile(serverUuid, 'index.js', botContent)
          console.log(`✅ Uploaded index.js to server ${serverUuid}`)
        } else {
          throw new Error(`Failed to download index.js: ${botResponse.statusText} (${botResponse.status})`)
        }
      } catch (error: any) {
        console.error(`❌ Could not download/upload index.js:`, error.message)
        throw error
      }
      
      // 2. Download and upload package.json
      console.log(`📥 Downloading package.json...`)
      try {
        const packageUrl = `${baseUrl}/package.json`
        const packageResponse = await fetch(packageUrl, { headers })
        if (packageResponse.ok) {
          const packageContent = await packageResponse.text()
          await this.uploadFile(serverUuid, 'package.json', packageContent)
          console.log(`✅ Uploaded package.json`)
        } else {
          console.warn(`⚠️  Could not download package.json (non-critical)`)
        }
      } catch (error: any) {
        console.warn(`⚠️  Could not download package.json:`, error.message)
      }
      
      // 3. Download and deploy modules directory recursively
      console.log(`📥 Downloading modules directory...`)
      try {
        const deployedCount = await this.deployModulesDirectory(serverUuid, repoUrl, branch, githubToken)
        console.log(`✅ Modules directory deployed (${deployedCount} files)`)
      } catch (error: any) {
        console.error(`❌ Could not deploy modules directory:`, error.message)
        console.error(`   Error details:`, error)
        // This is critical - bot won't work without modules
        throw new Error(`Failed to deploy modules directory: ${error.message}`)
      }
      
      console.log(`✅ Bot files deployed directly from GitHub`)
    } catch (error: any) {
      console.error(`❌ Failed to deploy bot files directly:`, error.message)
      throw error
    }
  }

  // Deploy bot files from GitHub to server using Git clone (more reliable than file uploads)
  async deployBotFilesFromGitHub(serverUuid: string, repoUrl: string = 'https://github.com/master00J/codecraft-solutions', branch: string = 'main', githubToken?: string): Promise<void> {
    try {
      console.log(`📦 Deploying bot files from GitHub to server ${serverUuid} using Git clone...`)
      
      // Build git clone URL with token if provided
      let cloneUrl = repoUrl.replace('.git', '')
      if (!cloneUrl.startsWith('http')) {
        cloneUrl = `https://${cloneUrl}`
      }
      
      // If GitHub token provided, insert it into URL for authentication
      if (githubToken && cloneUrl.includes('github.com')) {
        // Format: https://token@github.com/user/repo
        cloneUrl = cloneUrl.replace('https://', `https://${githubToken}@`)
      }
      
      // Create a deployment script that clones the repository
      const deployScript = `#!/bin/bash
cd /home/container

echo "📦 Cloning repository from GitHub..."
# Remove existing files if they exist (except .env)
rm -f index.js package.json package-lock.json 2>/dev/null || true
rm -rf modules 2>/dev/null || true

# Clone repository
${githubToken ? `GIT_ASKPASS=echo GIT_TERMINAL_PROMPT=0 git clone --depth 1 --branch ${branch} ${cloneUrl} /tmp/bot-repo 2>&1` : `git clone --depth 1 --branch ${branch} ${cloneUrl} /tmp/bot-repo 2>&1`}

if [ ! -d /tmp/bot-repo ]; then
    echo "❌ Failed to clone repository"
    exit 1
fi

echo "📋 Copying bot files..."
# Copy main bot file as index.js
if [ -f /tmp/bot-repo/index.js ]; then
    cp /tmp/bot-repo/index.js ./index.js
    echo "✅ Copied index.js"
else
    echo "⚠️  index.js not found in repository"
fi

# Copy package files
if [ -f /tmp/bot-repo/package.json ]; then
    cp /tmp/bot-repo/package.json ./
    echo "✅ Copied package.json"
fi

if [ -f /tmp/bot-repo/package-lock.json ]; then
    cp /tmp/bot-repo/package-lock.json ./
    echo "✅ Copied package-lock.json"
fi

# Copy modules directory
if [ -d /tmp/bot-repo/modules ]; then
    cp -r /tmp/bot-repo/modules ./
    echo "✅ Copied modules/ directory"
else
    echo "⚠️  modules/ directory not found in repository"
fi

# Install dependencies
if [ -f package.json ]; then
    echo "📦 Installing dependencies from package.json..."
    npm install --production 2>&1 || echo "⚠️  Some packages may have failed to install"
    
    # Install additional required packages
    echo "📦 Installing additional required packages..."
    npm install p-queue @google/generative-ai @anthropic-ai/sdk @google/genai canvas topgg-autoposter --save --production 2>&1 || echo "⚠️  Some additional packages may have failed to install"
fi

# Cleanup
rm -rf /tmp/bot-repo
echo "✅ Bot files deployed successfully"
`
      
      // Upload deployment script
      await this.uploadFile(serverUuid, 'deploy.sh', deployScript)
      
      // Make executable (Pterodactyl API expects "files" as array)
      try {
        await this.request(
          `/servers/${serverUuid}/files/chmod`,
          {
            method: 'POST',
            body: JSON.stringify({
              root: '/home/container',
              files: ['deploy.sh'],
              mode: '755'
            })
          },
          'client'
        )
      } catch (chmodError: any) {
        // Chmod might not work on some Pterodactyl setups, that's okay
        // Scripts can still be executed with bash even without chmod
        if (chmodError?.status !== 422) {
          console.warn(`⚠️  Could not set execute permissions on deploy.sh (non-critical)`)
        }
      }
      
      console.log(`✅ Deployment script created: deploy.sh`)
      console.log(`ℹ️  Run 'bash deploy.sh' in the server console to deploy files`)
      console.log(`ℹ️  Or set startup command to: bash deploy.sh && node index.js`)
      
    } catch (error: any) {
      console.warn(`⚠️  Could not create deployment script:`, error.message)
      throw error
    }
  }

  // Deploy modules directory recursively from GitHub
  async deployModulesDirectory(serverUuid: string, repoUrl: string = 'https://github.com/master00J/codecraft-solutions', branch: string = 'main', githubToken?: string): Promise<number> {
    try {
      // Use GitHub API to get directory contents
      const repoPath = repoUrl.replace('https://github.com/', '').replace('.git', '')
      const apiUrl = `https://api.github.com/repos/${repoPath}/contents/modules?ref=${branch}`
      
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json'
      }
      if (githubToken) {
        headers['Authorization'] = `token ${githubToken}`
      }

      const response = await fetch(apiUrl, { headers })
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} - ${response.statusText}`)
      }

      const contents = await response.json()
      if (!Array.isArray(contents)) {
        throw new Error('Expected array of files from GitHub API')
      }

      let deployedCount = 0
      
      // Recursively process all files in modules directory
      const processItem = async (item: any, basePath: string = 'modules'): Promise<void> => {
        if (item.type === 'file') {
          // Download and upload file - preserve directory structure
          const filePath = `${basePath}/${item.name}`
          const fileUrl = item.download_url || `https://raw.githubusercontent.com/${repoPath}/${branch}/${item.path}`
          
          console.log(`   📄 Deploying ${filePath}...`)
          try {
            await this.downloadAndUploadFile(serverUuid, filePath, fileUrl, githubToken)
            deployedCount++
            console.log(`   ✅ Deployed ${filePath}`)
          } catch (error: any) {
            console.error(`   ❌ Could not deploy ${filePath}:`, error.message)
            // Don't throw - continue with other files
          }
        } else if (item.type === 'dir') {
          console.log(`   📁 Processing directory: ${item.path}...`)
          // Recursively fetch directory contents
          const dirApiUrl = `https://api.github.com/repos/${repoPath}/contents/${item.path}?ref=${branch}`
          const dirResponse = await fetch(dirApiUrl, { headers })
          
          if (dirResponse.ok) {
            const dirContents = await dirResponse.json()
            if (Array.isArray(dirContents)) {
              // Preserve directory structure by using the full path
              const newBasePath = `${basePath}/${item.name}`
              for (const subItem of dirContents) {
                await processItem(subItem, newBasePath)
              }
            }
          } else {
            console.warn(`   ⚠️  Could not fetch directory ${item.path}: ${dirResponse.statusText}`)
          }
        }
      }

      // Process all items in modules directory
      for (const item of contents) {
        await processItem(item)
      }

      return deployedCount
    } catch (error: any) {
      console.warn(`⚠️  Error deploying modules directory:`, error.message)
      throw error
    }
  }

  // Create a startup script that downloads files from GitHub and starts the bot
  async createStartupScript(serverUuid: string, repoUrl: string = 'https://github.com/master00J/codecraft-bot', branch: string = 'main', githubToken?: string): Promise<void> {
    try {
      // Build git clone URL with token if provided
      let cloneUrl = repoUrl
      if (githubToken && repoUrl.includes('github.com')) {
        // Insert token into URL for authentication
        cloneUrl = repoUrl.replace('https://', `https://${githubToken}@`)
      }
      
      const scriptContent = `#!/bin/bash
# Auto-deploy bot files from GitHub and start bot
cd /home/container

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Pull latest code from GitHub if repository exists
if [ -d .git ]; then
    echo "📥 Pulling latest code from GitHub..."
    git pull origin ${branch} 2>&1 || echo "⚠️  Git pull failed (continuing with existing files)"
fi

# Clone repository if index.js doesn't exist
if [ ! -f index.js ]; then
    echo "📦 Cloning bot files from GitHub..."
    ${githubToken ? `GIT_ASKPASS=echo GIT_TERMINAL_PROMPT=0 git clone --depth 1 --branch ${branch} ${cloneUrl} /tmp/bot-files 2>/dev/null || true` : `git clone --depth 1 --branch ${branch} ${cloneUrl} /tmp/bot-files 2>/dev/null || true`}
    
    if [ -d /tmp/bot-files ]; then
        # Copy bot files (index.js for auto-start)
        cp -r /tmp/bot-files/index.js ./index.js 2>/dev/null || true
        cp -r /tmp/bot-files/modules . 2>/dev/null || true
        cp -r /tmp/bot-files/package*.json . 2>/dev/null || true
        cp -r /tmp/bot-files/*.json . 2>/dev/null || true
        
        # Initialize git repository for future pulls
        git init 2>/dev/null || true
        git remote add origin ${repoUrl.replace('.git', '')} 2>/dev/null || git remote set-url origin ${repoUrl.replace('.git', '')} 2>/dev/null || true
        
        # Cleanup
        rm -rf /tmp/bot-files
        echo "✅ Bot files deployed"
    fi
fi

# Always check and install dependencies if package.json exists
if [ -f package.json ]; then
    if [ ! -d node_modules ] || [ ! -f node_modules/.package-lock.json ]; then
        echo "📦 Installing dependencies from package.json..."
        npm install --production 2>&1 || {
            echo "⚠️  npm install failed, trying with --legacy-peer-deps..."
            npm install --production --legacy-peer-deps 2>&1 || echo "⚠️  Some packages may have failed to install"
        }
        echo "✅ Dependencies installed"
    else
        echo "✅ Dependencies already installed"
    fi
fi

# Start bot
echo "🚀 Starting bot..."
exec node index.js
`

      await this.uploadFile(serverUuid, 'start.sh', scriptContent)
      
      // Make executable (Pterodactyl API expects "files" as array)
      try {
        await this.request(
          `/servers/${serverUuid}/files/chmod`,
          {
            method: 'POST',
            body: JSON.stringify({
              root: '/home/container',
              files: ['start.sh'],
              mode: '755'
            })
          },
          'client'
        )
      } catch (chmodError: any) {
        // Chmod might not work on some Pterodactyl setups, that's okay
        // Scripts can still be executed with bash even without chmod
        if (chmodError?.status !== 422) {
          console.log(`ℹ️  Could not set executable permissions (may need to be done manually)`)
        }
      }
      
      console.log(`✅ Startup script created: start.sh`)
    } catch (error: any) {
      console.warn(`⚠️  Could not create startup script:`, error.message)
      throw error
    }
  }

  // Install Node.js packages via Pterodactyl API
  async installNodePackages(serverUuid: string, packages: string[]): Promise<void> {
    try {
      console.log(`📦 Installing Node.js packages: ${packages.join(', ')}`)
      
      // Pterodactyl API endpoint: POST /api/client/servers/{server_uuid}/packages/nodejs/search
      // Then install via package manager
      // Note: Pterodactyl might not have direct install endpoint, so we'll use a startup command
      // For now, we'll create a script that runs npm install
      
      const installScript = `#!/bin/bash
cd /home/container
echo "📦 Installing Node.js packages..."
npm install ${packages.join(' ')} --save --production
echo "✅ Packages installed"
`
      
      await this.uploadFile(serverUuid, 'install-packages.sh', installScript)
      
      // Try to make it executable (Pterodactyl API expects "files" as array)
      try {
        await this.request(
          `/servers/${serverUuid}/files/chmod`,
          {
            method: 'POST',
            body: JSON.stringify({
              root: '/home/container',
              files: ['install-packages.sh'],
              mode: '755'
            })
          },
          'client'
        )
      } catch (chmodError: any) {
        // Chmod might not work on some Pterodactyl setups, that's okay
        // Scripts can still be executed with bash even without chmod
        if (chmodError?.status !== 422) {
          console.warn(`⚠️  Could not set execute permissions on install-packages.sh (non-critical)`)
        }
      }
      
      console.log(`✅ Package installation script created: install-packages.sh`)
      console.log(`ℹ️  Run 'bash install-packages.sh' in the server console to install packages`)
    } catch (error: any) {
      console.warn(`⚠️  Could not create package installation script:`, error.message)
      throw error
    }
  }

  // Write .env file to server (fallback if variables not in egg)
  async writeEnvFile(serverUuid: string, variables: Record<string, string>): Promise<void> {
    try {
      // Create .env file content
      const envContent = Object.entries(variables)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n')
      
      // Write to /home/container/.env via file API
      // Note: This requires the file to be written via startup command or manually
      // For now, we'll log it and the user can add it manually or via egg install script
      console.log(`📝 Environment variables to add to .env file:`)
      console.log(envContent)
      console.log(`\nℹ️  These variables should be added to the server's .env file or egg configuration`)
      
      // Try to write via file API (if available) - use uploadFile to ensure base64 encoding
      try {
        await this.uploadFile(serverUuid, '.env', envContent)
        console.log(`✅ .env file written successfully`)
      } catch (fileError: any) {
        console.warn(`⚠️  Could not write .env file via API:`, fileError.message)
        console.log(`ℹ️  Variables will need to be set manually in Pterodactyl panel`)
      }
    } catch (error: any) {
      console.warn(`⚠️  Failed to write .env file:`, error.message)
    }
  }

  // Set multiple environment variables at once
  async setEnvironmentVariables(
    serverUuid: string,
    variables: Record<string, string>
  ): Promise<void> {
    const failedVariables: Record<string, string> = {}
    
    for (const [name, value] of Object.entries(variables)) {
      try {
        await this.setEnvironmentVariable(serverUuid, name, value)
      } catch (error: any) {
        // If variable not in egg config, add to failed list for .env file
        if (error.message?.includes('not in egg config')) {
          failedVariables[name] = value
        } else {
          console.warn(`⚠️  Failed to set ${name}:`, error.message)
        }
      }
    }
    
    // If any variables failed (not in egg), write them to .env file
    if (Object.keys(failedVariables).length > 0) {
      console.log(`\n📝 Writing ${Object.keys(failedVariables).length} variables to .env file (not in egg config)...`)
      await this.writeEnvFile(serverUuid, failedVariables)
    }
  }

  // List all servers - SparkedHost doesn't have a direct list endpoint
  // Instead, you need to track servers in your database
  async listServers(): Promise<any[]> {
    console.warn('⚠️ SparkedHost does not provide /api/client/servers endpoint')
    console.log('📋 Servers must be tracked via database after creation')
    // Return empty array - servers are tracked in bot_deployments table
    return []
  }

  // Get server by name/identifier (helper function)
  // Note: This requires Application API access to list all servers
  async getServerByName(serverName: string): Promise<ServerDetails | null> {
    try {
      // Try to get server list via Application API (requires admin API key)
      const response = await this.request<{ data: any[] }>(
        '/servers',
        {},
        'application' // Use Application API instead of Client API
      )

      const servers = response.data || []
      const server = servers.find((s: any) => 
        s.attributes.name?.toLowerCase() === serverName.toLowerCase() ||
        s.attributes.identifier?.toLowerCase() === serverName.toLowerCase()
      )

      if (server) {
        return server.attributes
      }

      console.warn(`⚠️ Server "${serverName}" not found`)
      return null
    } catch (error: any) {
      console.warn(`⚠️ Could not fetch server by name: ${error.message}`)
      console.log('ℹ️  You may need to use Application API key to list servers')
      return null
    }
  }

  // Get server UUID by identifier (short ID like "68915ad1")
  // This is useful when you only have the identifier from the URL
  async getServerUuidByIdentifier(identifier: string): Promise<string | null> {
    try {
      // Try to get server list via Application API
      const response = await this.request<{ data: any[] }>(
        '/servers',
        {},
        'application'
      )

      const servers = response.data || []
      const server = servers.find((s: any) => 
        s.attributes.identifier?.toLowerCase() === identifier.toLowerCase()
      )

      if (server) {
        const uuid = server.attributes.uuid
        console.log(`✅ Found UUID for identifier "${identifier}": ${uuid}`)
        return uuid
      }

      console.warn(`⚠️ Server with identifier "${identifier}" not found`)
      return null
    } catch (error: any) {
      console.warn(`⚠️ Could not fetch server UUID by identifier: ${error.message}`)
      console.log('ℹ️  You may need to use Application API key to list servers')
      return null
    }
  }

  // Get available allocations for a node (Dedicated API)
  async getNodeAllocations(nodeId: number): Promise<any[]> {
    try {
      const response = await this.request<{ data: any[] }>(
        `/dedicated/${nodeId}/allocations`
      )
      return response.data || []
    } catch (error) {
      console.warn('Could not fetch allocations, using default')
      return []
    }
  }

  // Get account info
  async getAccountInfo(): Promise<any> {
    const response = await this.request<{ attributes: any }>(
      '/account'
    )
    return response.attributes
  }

  // List dedicated nodes (if available)
  async listDedicatedNodes(): Promise<any[]> {
    try {
      const response = await this.request<{ data: any[] }>(
        '/dedicated'
      )
      return response.data || []
    } catch (error) {
      console.warn('No dedicated nodes or endpoint not available')
      return []
    }
  }

  // List all sub-servers under parent server
  async listSubServers(parentUuid?: string): Promise<any[]> {
    const uuid = parentUuid || PTERODACTYL_CONFIG.PARENT_SERVER_UUID
    
    if (!uuid) {
      console.warn('No parent server UUID configured')
      return []
    }

    try {
      const response = await this.request<{ data: any[] }>(
        `/servers/${uuid}/splitter`
      )
      return response.data || []
    } catch (error) {
      console.warn('Could not fetch sub-servers')
      return []
    }
  }

  // Get list of available eggs for sub-servers
  async getAvailableEggs(parentUuid?: string): Promise<any[]> {
    const uuid = parentUuid || PTERODACTYL_CONFIG.PARENT_SERVER_UUID
    
    if (!uuid) {
      return []
    }

    try {
      const response = await this.request<{ data: any[] }>(
        `/servers/${uuid}/splitter/eggs`
      )
      return response.data || []
    } catch (error) {
      console.warn('Could not fetch available eggs')
      return []
    }
  }
}

// Singleton instance
let pterodactylClient: PterodactylClient | null = null

export function getPterodactylClient(): PterodactylClient {
  if (!pterodactylClient) {
    pterodactylClient = new PterodactylClient()
  }
  return pterodactylClient
}


/**
 * Pterodactyl Panel API Client
 * Handles server provisioning for custom bots
 * 
 * Documentation: https://pterodactyl.io/project/api/
 */

const PTERODACTYL_PANEL_URL = process.env.PTERODACTYL_PANEL_URL || '';
const PTERODACTYL_API_KEY = process.env.PTERODACTYL_API_KEY || '';
const PTERODACTYL_PARENT_SERVER_UUID = process.env.PTERODACTYL_PARENT_SERVER_UUID || '';
const PTERODACTYL_BOT_EGG_ID = process.env.PTERODACTYL_BOT_EGG_ID || '';
const PTERODACTYL_DOCKER_IMAGE = process.env.PTERODACTYL_DOCKER_IMAGE || '';
const PTERODACTYL_DEFAULT_USER_ID = process.env.PTERODACTYL_DEFAULT_USER_ID || '';
const PTERODACTYL_BOT_NEST_ID = process.env.PTERODACTYL_BOT_NEST_ID || '';
const PTERODACTYL_DEFAULT_NODE_ID = process.env.PTERODACTYL_DEFAULT_NODE_ID || '';

interface PterodactylServer {
  id: string;
  uuid: string;
  identifier: string;
  name: string;
  description: string;
  status: 'installing' | 'suspended' | 'restoring_backup' | null;
  suspended: boolean;
  limits: {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
  };
  feature_limits: {
    databases: number;
    allocations: number;
    backups: number;
  };
  user: number;
  node: number;
  allocation: number;
  nest: number;
  egg: number;
  created_at: string;
  updated_at: string;
}

interface CreateServerOptions {
  name: string;
  description: string;
  bot_token: string;
  guild_id: string;
  bot_application_id: string;
  memory_mb?: number;
  swap_mb?: number;
  disk_mb?: number;
  io?: number;
  cpu?: number;
  environment_variables?: Record<string, string>;
}

interface ServerStartup {
  startup: string;
  environment: Record<string, string>;
  egg: number;
  image: string;
  skip_scripts: boolean;
}

class PterodactylClient {
  private panelUrl: string;
  private apiKey: string;
  private parentServerUuid: string;
  private botEggId: string;
  private dockerImage: string;
  private defaultUserId: string;
  private botNestId: string;
  private defaultNodeId: string;

  constructor() {
    this.panelUrl = PTERODACTYL_PANEL_URL.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = PTERODACTYL_API_KEY;
    this.parentServerUuid = PTERODACTYL_PARENT_SERVER_UUID;
    this.botEggId = PTERODACTYL_BOT_EGG_ID;
    this.dockerImage = PTERODACTYL_DOCKER_IMAGE;
    this.defaultUserId = PTERODACTYL_DEFAULT_USER_ID;
    this.botNestId = PTERODACTYL_BOT_NEST_ID;
    this.defaultNodeId = PTERODACTYL_DEFAULT_NODE_ID;

    if (!this.panelUrl || !this.apiKey) {
      console.warn('⚠️ Pterodactyl API credentials not configured');
    }
  }

  /**
   * Get API headers
   */
  private getHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Get available nodes
   */
  async getNodes(): Promise<any[]> {
    try {
      const response = await fetch(`${this.panelUrl}/api/application/nodes`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Pterodactyl API error: ${error.errors?.[0]?.detail || response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Pterodactyl nodes:', error);
      throw error;
    }
  }

  /**
   * Get available allocations for a node
   */
  async getAllocations(nodeId: number): Promise<any[]> {
    try {
      // First verify the node exists
      const nodeResponse = await fetch(`${this.panelUrl}/api/application/nodes/${nodeId}`, {
        headers: this.getHeaders()
      });

      if (!nodeResponse.ok) {
        const nodeError = await nodeResponse.json().catch(() => ({}));
        throw new Error(`Node ${nodeId} not found: ${nodeError.errors?.[0]?.detail || nodeResponse.statusText}`);
      }

      // Get allocations with pagination support
      const response = await fetch(`${this.panelUrl}/api/application/nodes/${nodeId}/allocations?per_page=500`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const errorMessage = error.errors?.[0]?.detail || response.statusText;
        console.error(`Failed to fetch allocations for node ${nodeId}:`, errorMessage);
        throw new Error(`Pterodactyl API error: ${errorMessage}`);
      }

      const data = await response.json();
      
      // Handle different response formats
      const allocations = data.data || data || [];
      
      // Filter for unassigned allocations
      // Handle both direct array and nested attributes
      const unassigned = allocations.filter((alloc: any) => {
        const assigned = alloc.attributes?.assigned ?? alloc.assigned ?? false;
        return !assigned;
      });

      if (unassigned.length === 0) {
        console.warn(`⚠️ No unassigned allocations found for node ${nodeId}`);
      }

      return unassigned;
    } catch (error: any) {
      console.error(`Error fetching allocations for node ${nodeId}:`, error);
      throw error;
    }
  }

  /**
   * Get egg details
   */
  async getEgg(nestId: string, eggId: string): Promise<any> {
    try {
      const response = await fetch(`${this.panelUrl}/api/application/nests/${nestId}/eggs/${eggId}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Pterodactyl API error: ${error.errors?.[0]?.detail || response.statusText}`);
      }

      const data = await response.json();
      return data.attributes || {};
    } catch (error) {
      console.error('Error fetching egg:', error);
      throw error;
    }
  }

  /**
   * Create a new Pterodactyl server for a custom bot
   */
  async createServer(options: CreateServerOptions): Promise<PterodactylServer> {
    try {
      // Get node (use default or find available)
      let nodeId: number;
      let selectedNode: any = null;
      
      if (this.defaultNodeId) {
        const defaultNodeIdNum = parseInt(this.defaultNodeId);
        console.log(`📌 Attempting to use default node ID: ${defaultNodeIdNum}`);
        
        // Verify node exists
        try {
          const nodeResponse = await fetch(`${this.panelUrl}/api/application/nodes/${defaultNodeIdNum}`, {
            headers: this.getHeaders()
          });
          
          if (!nodeResponse.ok) {
            throw new Error(`Node ${defaultNodeIdNum} not found`);
          }
          
          const nodeData = await nodeResponse.json();
          selectedNode = nodeData.attributes || nodeData;
          nodeId = defaultNodeIdNum;
          console.log(`✅ Default node ${nodeId} is available`);
        } catch (nodeError: any) {
          console.warn(`⚠️ Default node ${defaultNodeIdNum} not accessible: ${nodeError.message}`);
          console.log('🔍 Falling back to searching for available nodes...');
          
          // Fallback: search for available nodes
          try {
            const nodes = await this.getNodes();
            if (nodes.length === 0) {
              throw new Error('No nodes found in Pterodactyl panel');
            }
            
            selectedNode = nodes.find((n: any) => {
              const node = n.attributes || n;
              const allocated = node.allocated_resources?.memory || 0;
              const limit = node.allocated_resources?.memory_limit || 0;
              return allocated < limit;
            });
            
            // If no node with available resources, use first node anyway
            if (!selectedNode && nodes.length > 0) {
              console.warn('⚠️ No nodes with available resources found, using first available node');
              selectedNode = nodes[0];
            }
            
            if (!selectedNode) {
              throw new Error('No nodes available in Pterodactyl panel');
            }
            
            nodeId = (selectedNode.attributes || selectedNode).id;
            console.log(`✅ Found fallback node: ${nodeId}`);
          } catch (fallbackError: any) {
            console.error('❌ Error finding fallback node:', fallbackError);
            throw new Error(`Default node ${defaultNodeIdNum} is not available and fallback failed: ${fallbackError.message}`);
          }
        }
      } else {
        console.log('🔍 Searching for available nodes...');
        const nodes = await this.getNodes();
        
        if (nodes.length === 0) {
          throw new Error('No nodes found in Pterodactyl panel. Please configure at least one node.');
        }
        
        selectedNode = nodes.find((n: any) => {
          const node = n.attributes || n;
          const allocated = node.allocated_resources?.memory || 0;
          const limit = node.allocated_resources?.memory_limit || 0;
          return allocated < limit;
        });
        
        // If no node with available resources, use first node anyway
        if (!selectedNode) {
          console.warn('⚠️ No nodes with available resources found, using first available node');
          selectedNode = nodes[0];
        }
        
        nodeId = (selectedNode.attributes || selectedNode).id;
        console.log(`✅ Found available node: ${nodeId}`);
      }

      // Get available allocation
      console.log(`🔍 Fetching allocations for node ${nodeId}...`);
      const allocations = await this.getAllocations(nodeId);
      
      if (allocations.length === 0) {
        // Try to create a new allocation if possible, or use a different approach
        console.warn(`⚠️ No unassigned allocations found for node ${nodeId}`);
        throw new Error(`No available allocations on node ${nodeId}. Please create allocations in Pterodactyl panel first.`);
      }
      
      const allocation = allocations[0].attributes || allocations[0];
      console.log(`✅ Found available allocation: ${allocation.ip}:${allocation.port || allocation.port_alias || 'N/A'}`);

      // Get egg details for startup configuration
      const egg = await this.getEgg(this.botNestId, this.botEggId);

      // Prepare environment variables
      const envVars: Record<string, string> = {
        DISCORD_BOT_TOKEN: options.bot_token,
        GUILD_ID: options.guild_id,
        BOT_APPLICATION_ID: options.bot_application_id,
        NODE_ENV: 'production',
        ...options.environment_variables
      };

      // Build startup command from egg
      const startupCommand = egg.startup || 'node bot-comcraft.js';
      
      // Replace environment variables in startup command
      let finalStartup = startupCommand;
      for (const [key, value] of Object.entries(envVars)) {
        finalStartup = finalStartup.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }

      // Format environment variables according to egg configuration
      // Pterodactyl expects environment variables in the format: { "EGG_VAR_NAME": "value" }
      // We need to map our env vars to the egg's expected variable names
      const eggVariables: Record<string, string> = {};
      
      // Get egg environment variables from egg.relationships?.variables or egg.variables
      const eggEnvVars = egg.relationships?.variables?.data || egg.variables || [];
      
      // Map our environment variables to egg variable format
      // Default mappings (can be customized based on your egg configuration)
      const defaultMappings: Record<string, string> = {
        'DISCORD_BOT_TOKEN': 'DISCORD_BOT_TOKEN',
        'GUILD_ID': 'GUILD_ID',
        'BOT_APPLICATION_ID': 'BOT_APPLICATION_ID',
        'NODE_ENV': 'NODE_ENV'
      };
      
      // Build environment object for Pterodactyl
      // Each egg variable needs to be set with its corresponding value
      for (const eggVar of eggEnvVars) {
        const varName = eggVar.attributes?.name || eggVar.name;
        const varEnvName = eggVar.attributes?.env_variable || eggVar.env_variable || varName;
        
        // Find matching value from our envVars
        const mappedKey = defaultMappings[varName] || varName;
        const value = envVars[mappedKey] || eggVar.attributes?.default_value || eggVar.default_value || '';
        
        // Use the egg's environment variable name as the key
        eggVariables[varEnvName] = value;
      }
      
      // If no egg variables found, use direct mapping
      if (Object.keys(eggVariables).length === 0) {
        Object.assign(eggVariables, envVars);
      }

      // Create server via Pterodactyl API
      const serverData = {
        name: options.name,
        description: options.description,
        user: parseInt(this.defaultUserId),
        egg: parseInt(this.botEggId),
        docker_image: this.dockerImage,
        startup: startupCommand,
        environment: eggVariables, // Use egg variables format
        limits: {
          memory: options.memory_mb || 512,
          swap: options.swap_mb || 0,
          disk: options.disk_mb || 1024,
          io: options.io || 500,
          cpu: options.cpu || 100
        },
        feature_limits: {
          databases: 0,
          allocations: 1,
          backups: 0
        },
        allocation: {
          default: allocation.id || (allocation.attributes && allocation.attributes.id) || allocation,
          additional: []
        },
        deploy: {
          locations: [nodeId],
          dedicated_ip: false,
          port_range: []
        },
        // Git repository for automatic file deployment
        git_repository: process.env.GIT_REPOSITORY_URL ? {
          repository: process.env.GIT_REPOSITORY_URL,
          branch: process.env.GIT_BRANCH || 'main',
          commit: null // null = latest commit
        } : undefined
      };

      const response = await fetch(`${this.panelUrl}/api/application/servers`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(serverData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create server: ${error.errors?.[0]?.detail || response.statusText}`);
      }

      const data = await response.json();
      return data.attributes;
    } catch (error) {
      console.error('Error creating Pterodactyl server:', error);
      throw error;
    }
  }

  /**
   * Get server details
   */
  async getServer(serverId: string): Promise<PterodactylServer> {
    try {
      const response = await fetch(`${this.panelUrl}/api/application/servers/${serverId}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to get server: ${error.errors?.[0]?.detail || response.statusText}`);
      }

      const data = await response.json();
      return data.attributes;
    } catch (error) {
      console.error('Error getting server:', error);
      throw error;
    }
  }

  /**
   * Get server by external ID (UUID)
   */
  async getServerByExternalId(externalId: string): Promise<PterodactylServer> {
    try {
      const response = await fetch(`${this.panelUrl}/api/application/servers/external/${externalId}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to get server: ${error.errors?.[0]?.detail || response.statusText}`);
      }

      const data = await response.json();
      return data.attributes;
    } catch (error) {
      console.error('Error getting server by external ID:', error);
      throw error;
    }
  }

  /**
   * Start a server
   * Note: Uses Application API, not Client API (requires admin permissions)
   */
  async startServer(serverId: string): Promise<void> {
    try {
      const server = await this.getServer(serverId);
      // Use application API for power management (admin access)
      const response = await fetch(`${this.panelUrl}/api/application/servers/${serverId}/power`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ signal: 'start' })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to start server: ${error.errors?.[0]?.detail || response.statusText}`);
      }
    } catch (error) {
      console.error('Error starting server:', error);
      throw error;
    }
  }

  /**
   * Stop a server
   * Note: Uses Application API, not Client API (requires admin permissions)
   */
  async stopServer(serverId: string): Promise<void> {
    try {
      const response = await fetch(`${this.panelUrl}/api/application/servers/${serverId}/power`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ signal: 'stop' })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to stop server: ${error.errors?.[0]?.detail || response.statusText}`);
      }
    } catch (error) {
      console.error('Error stopping server:', error);
      throw error;
    }
  }

  /**
   * Restart a server
   * Note: Uses Application API, not Client API (requires admin permissions)
   */
  async restartServer(serverId: string): Promise<void> {
    try {
      const response = await fetch(`${this.panelUrl}/api/application/servers/${serverId}/power`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ signal: 'restart' })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to restart server: ${error.errors?.[0]?.detail || response.statusText}`);
      }
    } catch (error) {
      console.error('Error restarting server:', error);
      throw error;
    }
  }

  /**
   * Delete a server
   */
  async deleteServer(serverId: string): Promise<void> {
    try {
      const response = await fetch(`${this.panelUrl}/api/application/servers/${serverId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to delete server: ${error.errors?.[0]?.detail || response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting server:', error);
      throw error;
    }
  }

  /**
   * Get server logs URL
   */
  getServerLogsUrl(serverIdentifier: string): string {
    return `${this.panelUrl}/server/${serverIdentifier}`;
  }

  /**
   * Get server console URL
   */
  getServerConsoleUrl(serverIdentifier: string): string {
    return `${this.panelUrl}/server/${serverIdentifier}/console`;
  }

  /**
   * Upload files to server via SFTP
   * Note: This requires SFTP credentials and is slower than Git/Docker
   * Use Git repository or Docker image for automatic deployment instead
   */
  async uploadFilesToServer(serverId: string, files: { path: string; content: string | Buffer }[]): Promise<void> {
    // This would require SFTP client library (like ssh2-sftp-client)
    // For now, we recommend using Git repository or Docker image instead
    throw new Error('File upload via SFTP not implemented. Use Git repository or Docker image for automatic deployment.');
  }

  /**
   * Trigger server reinstall (re-clone Git repo)
   */
  async reinstallServer(serverId: string): Promise<void> {
    try {
      const response = await fetch(`${this.panelUrl}/api/application/servers/${serverId}/reinstall`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to reinstall server: ${error.errors?.[0]?.detail || response.statusText}`);
      }
    } catch (error) {
      console.error('Error reinstalling server:', error);
      throw error;
    }
  }
}

export const pterodactylClient = new PterodactylClient();
export type { PterodactylServer, CreateServerOptions };


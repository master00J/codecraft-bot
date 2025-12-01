/**
 * Admin API: Update webhook URLs for existing custom bot containers
 * POST /api/admin/custom-bots/update-webhook-urls
 * 
 * Updates bot_webhook_url for all existing Pterodactyl containers
 * that don't have a webhook URL set yet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getPterodactylClient } from '@/lib/pterodactyl/client';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('🔄 Starting webhook URL update for existing custom bot containers...');

    // Get all custom bots running on Pterodactyl that don't have a webhook URL yet
    // Include bots that have a pterodactyl_server_uuid (even if runs_on_pterodactyl is not explicitly set)
    // Also get pterodactyl_server_id and server_name for fallback lookup
    const { data: servers, error: dbError } = await supabase
      .from('custom_bot_tokens')
      .select('guild_id, pterodactyl_server_uuid, pterodactyl_server_id, server_name, bot_username, bot_webhook_url, runs_on_pterodactyl')
      .not('pterodactyl_server_uuid', 'is', null)
      .or('runs_on_pterodactyl.eq.true,runs_on_pterodactyl.is.null');

    if (dbError) {
      console.error('❌ Error fetching servers from database:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!servers || servers.length === 0) {
      console.log('ℹ️ No Pterodactyl servers found');
      return NextResponse.json({ 
        message: 'No Pterodactyl servers found', 
        updated: 0,
        skipped: 0,
        failed: 0
      });
    }

    // Filter servers that need webhook URL (don't have one yet)
    const serversToUpdate = servers.filter(server => !server.bot_webhook_url);
    
    if (serversToUpdate.length === 0) {
      console.log('✅ All servers already have webhook URLs');
      return NextResponse.json({ 
        message: 'All servers already have webhook URLs', 
        updated: 0,
        skipped: servers.length,
        failed: 0,
        total: servers.length
      });
    }

    console.log(`📦 Found ${serversToUpdate.length} server(s) that need webhook URL updates (out of ${servers.length} total)`);

    const client = getPterodactylClient();
    const results: { 
      guild_id: string; 
      status: 'updated' | 'skipped' | 'error'; 
      webhook_url?: string;
      error?: string 
    }[] = [];

    // Get base URL pattern from environment
    const baseUrlPattern = process.env.CUSTOM_BOT_BASE_URL || 'http://<IP>:<PORT>';

    for (const server of serversToUpdate) {
      try {
        console.log(`🔍 Processing server for guild ${server.guild_id} (${server.bot_username})...`);
        
        if (!server.pterodactyl_server_uuid) {
          console.warn(`⚠️  Server ${server.guild_id} has no UUID, skipping`);
          results.push({ 
            guild_id: server.guild_id, 
            status: 'skipped',
            error: 'No server UUID'
          });
          continue;
        }

        // Get server details from Pterodactyl
        // Try UUID first, then fallback to identifier or name lookup if 404
        let serverDetails: any = null;
        let serverLookupError: any = null;
        
        try {
          serverDetails = await client.getServer(server.pterodactyl_server_uuid);
          console.log(`📋 Server details retrieved for ${server.pterodactyl_server_uuid}`);
        } catch (uuidError: any) {
          serverLookupError = uuidError;
          console.warn(`⚠️  Failed to get server by UUID ${server.pterodactyl_server_uuid}, trying fallback methods...`);
          
          // Fallback 1: Try with identifier if available
          if (server.pterodactyl_server_id) {
            try {
              console.log(`   Trying with identifier: ${server.pterodactyl_server_id}`);
              serverDetails = await client.getServer(server.pterodactyl_server_id);
              console.log(`✅ Server found by identifier: ${server.pterodactyl_server_id}`);
            } catch (identifierError: any) {
              console.warn(`   Identifier lookup also failed: ${identifierError.message}`);
            }
          }
          
          // Fallback 2: Try to find server by name
          if (!serverDetails && server.server_name) {
            try {
              console.log(`   Trying to find server by name: ${server.server_name}`);
              const foundServer = await client.getServerByName(server.server_name);
              if (foundServer) {
                serverDetails = foundServer;
                console.log(`✅ Server found by name: ${server.server_name}`);
              }
            } catch (nameError: any) {
              console.warn(`   Name lookup also failed: ${nameError.message}`);
            }
          }
          
          // If still no server found, throw original error
          if (!serverDetails) {
            throw uuidError;
          }
        }

        // Get allocation (IP:Port) from server details
        let allocationIp: string | null = null;
        let allocationPort: number | null = null;

        // Debug: Log server details structure
        console.log(`   Server details keys:`, Object.keys(serverDetails).join(', '));
        if (serverDetails.relationships) {
          console.log(`   Relationships keys:`, Object.keys(serverDetails.relationships).join(', '));
        }

        // Try different possible structures for allocation data
        if (serverDetails.relationships?.allocations?.data?.[0]) {
          // Application API format with relationships
          const allocation = serverDetails.relationships.allocations.data[0];
          console.log(`   Found allocation in relationships.allocations.data[0]`);
          allocationIp = allocation.attributes?.ip || allocation.ip || allocation.attributes?.ip_alias || allocation.ip_alias;
          allocationPort = allocation.attributes?.port || allocation.port || allocation.attributes?.port_alias || allocation.port_alias;
        } else if (serverDetails.allocations) {
          // Direct allocations array or object
          const allocation = Array.isArray(serverDetails.allocations) 
            ? serverDetails.allocations[0] 
            : serverDetails.allocations;
          console.log(`   Found allocation in serverDetails.allocations`);
          allocationIp = allocation?.attributes?.ip || allocation?.ip || allocation?.attributes?.ip_alias || allocation?.ip_alias;
          allocationPort = allocation?.attributes?.port || allocation?.port || allocation?.attributes?.port_alias || allocation?.port_alias;
        } else if (serverDetails.allocation) {
          // serverDetails.allocation might be an ID (number) or an object
          const allocation = serverDetails.allocation;
          console.log(`   Found allocation in serverDetails.allocation:`, typeof allocation === 'object' ? JSON.stringify(allocation).substring(0, 200) : allocation);
          
          // If it's an object, try to get IP:Port directly
          if (typeof allocation === 'object') {
            allocationIp = allocation?.attributes?.ip || allocation?.ip || allocation?.attributes?.ip_alias || allocation?.ip_alias;
            allocationPort = allocation?.attributes?.port || allocation?.port || allocation?.attributes?.port_alias || allocation?.port_alias;
          } else if (typeof allocation === 'number' && serverDetails.node) {
            // If it's just an ID, we need to fetch allocation details from the node
            console.log(`   Allocation is an ID (${allocation}), fetching details from node ${serverDetails.node}`);
            try {
              const clientAny = client as any;
              const nodeAllocationsResponse = await clientAny.request(
                `/nodes/${serverDetails.node}/allocations`,
                { method: 'GET' },
                'application'
              ) as any;
              
              const nodeAllocations = nodeAllocationsResponse.data || [];
              const foundAllocation = nodeAllocations.find((a: any) => {
                const allocId = a.attributes?.id || a.id;
                return allocId === allocation;
              });
              
              if (foundAllocation) {
                const allocData = foundAllocation.attributes || foundAllocation;
                allocationIp = allocData.ip || allocData.ip_alias;
                allocationPort = allocData.port || allocData.port_alias;
                console.log(`   ✅ Found allocation details via node: ${allocationIp}:${allocationPort}`);
              } else {
                console.warn(`   Could not find allocation ID ${allocation} in node ${serverDetails.node} allocations`);
              }
            } catch (nodeError: any) {
              console.warn(`   Could not fetch node allocations: ${nodeError.message}`);
            }
          }
        } else if (serverDetails.relationships?.allocations) {
          // Try relationships.allocations directly (without .data)
          const allocations = serverDetails.relationships.allocations;
          const allocation = Array.isArray(allocations) ? allocations[0] : allocations;
          console.log(`   Found allocation in relationships.allocations (direct)`);
          allocationIp = allocation?.attributes?.ip || allocation?.ip || allocation?.attributes?.ip_alias || allocation?.ip_alias;
          allocationPort = allocation?.attributes?.port || allocation?.port || allocation?.attributes?.port_alias || allocation?.port_alias;
        }

        // If still no allocation found, try to fetch allocations directly from API
        if (!allocationIp || !allocationPort) {
          try {
            console.log(`   Trying to fetch allocations directly from API for server ${serverDetails.identifier || serverDetails.uuid}`);
            const serverId = serverDetails.identifier || serverDetails.uuid;
            
            // Use the request method via type assertion (it's a private method but we need it)
            const clientAny = client as any;
            const allocationsResponse = await clientAny.request(
              `/servers/${serverId}/allocations`,
              { method: 'GET' },
              'application'
            ) as any;
            
            // Handle different response formats
            let allocations: any[] = [];
            if (allocationsResponse.data) {
              allocations = Array.isArray(allocationsResponse.data) ? allocationsResponse.data : [allocationsResponse.data];
            } else if (Array.isArray(allocationsResponse)) {
              allocations = allocationsResponse;
            } else {
              allocations = [allocationsResponse];
            }
            
            // Find the primary/default allocation (usually the first one or the one marked as default)
            const allocation = allocations.find((a: any) => a.attributes?.is_default || a.is_default) || allocations[0];
            
            if (allocation) {
              const allocData = allocation.attributes || allocation;
              allocationIp = allocData.ip || allocData.ip_alias;
              allocationPort = allocData.port || allocData.port_alias;
              console.log(`   ✅ Found allocation via direct API call: ${allocationIp}:${allocationPort}`);
            } else {
              console.warn(`   No allocations found in API response`);
            }
          } catch (allocError: any) {
            console.warn(`   Could not fetch allocations directly: ${allocError.message}`);
          }
        }

        if (allocationIp && allocationPort) {
          // Use allocation port - Pterodactyl forwards this to the container port (3002)
          // The container listens on port 3002, but external access is via the allocation port
          // Construct webhook URL
          const botWebhookUrl = baseUrlPattern
            .replace('<IP>', allocationIp)
            .replace('<PORT>', allocationPort.toString());

          console.log(`🔗 Constructed webhook URL: ${botWebhookUrl} (allocation ${allocationIp}:${allocationPort} -> forwarded to container port 3002)`);

          // Update database
          const { error: updateError } = await supabase
            .from('custom_bot_tokens')
            .update({
              bot_webhook_url: botWebhookUrl,
              updated_at: new Date().toISOString()
            })
            .eq('guild_id', server.guild_id);

          if (updateError) {
            console.error(`❌ Error updating webhook URL for guild ${server.guild_id}:`, updateError);
            results.push({ 
              guild_id: server.guild_id, 
              status: 'error',
              error: updateError.message
            });
          } else {
            console.log(`✅ Webhook URL updated for guild ${server.guild_id}`);
            results.push({ 
              guild_id: server.guild_id, 
              status: 'updated',
              webhook_url: botWebhookUrl
            });
          }
        } else {
          console.warn(`⚠️  Could not determine allocation (IP:Port) for server ${server.pterodactyl_server_uuid}`);
          results.push({ 
            guild_id: server.guild_id, 
            status: 'error',
            error: 'Could not determine allocation (IP:Port) from server details'
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (serverError: any) {
        console.error(`❌ Error processing server for guild ${server.guild_id}:`, serverError.message);
        results.push({ 
          guild_id: server.guild_id, 
          status: 'error',
          error: serverError.message
        });
      }
    }

    const updated = results.filter(r => r.status === 'updated').length;
    const failed = results.filter(r => r.status === 'error').length;
    const skipped = servers.length - serversToUpdate.length;

    console.log(`📊 Update complete: ${updated} updated, ${failed} failed, ${skipped} already had URLs`);

    return NextResponse.json({
      message: 'Webhook URL update complete',
      updated,
      failed,
      skipped,
      total: servers.length,
      results
    });

  } catch (error: any) {
    console.error('❌ Error updating webhook URLs:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}

// GET endpoint for status check
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get statistics
    // Include all bots that have a pterodactyl_server_uuid (even if runs_on_pterodactyl is not explicitly set)
    const { data: allServers } = await supabase
      .from('custom_bot_tokens')
      .select('guild_id, bot_webhook_url, runs_on_pterodactyl, pterodactyl_server_uuid')
      .not('pterodactyl_server_uuid', 'is', null)
      .or('runs_on_pterodactyl.eq.true,runs_on_pterodactyl.is.null');

    const total = allServers?.length || 0;
    const withUrl = allServers?.filter(s => s.bot_webhook_url).length || 0;
    const withoutUrl = total - withUrl;

    return NextResponse.json({
      status: 'ok',
      statistics: {
        total_servers: total,
        with_webhook_url: withUrl,
        without_webhook_url: withoutUrl
      },
      base_url_pattern: process.env.CUSTOM_BOT_BASE_URL || 'http://<IP>:<PORT>'
    });

  } catch (error: any) {
    console.error('❌ Error getting webhook URL status:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}


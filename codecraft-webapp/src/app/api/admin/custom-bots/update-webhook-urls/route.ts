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
    const { data: servers, error: dbError } = await supabase
      .from('custom_bot_tokens')
      .select('guild_id, pterodactyl_server_uuid, bot_username, bot_webhook_url, runs_on_pterodactyl')
      .eq('runs_on_pterodactyl', true)
      .not('pterodactyl_server_uuid', 'is', null);

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
        const serverDetails = await client.getServer(server.pterodactyl_server_uuid);
        console.log(`📋 Server details retrieved for ${server.pterodactyl_server_uuid}`);

        // Get allocation (IP:Port) from server details
        let allocationIp: string | null = null;
        let allocationPort: number | null = null;

        // Try different possible structures for allocation data
        if (serverDetails.relationships?.allocations?.data?.[0]) {
          // Application API format with relationships
          const allocation = serverDetails.relationships.allocations.data[0];
          allocationIp = allocation.attributes?.ip || allocation.ip || allocation.attributes?.ip_alias || allocation.ip_alias;
          allocationPort = allocation.attributes?.port || allocation.port || allocation.attributes?.port_alias || allocation.port_alias;
        } else if (serverDetails.allocations) {
          // Direct allocations array or object
          const allocation = Array.isArray(serverDetails.allocations) 
            ? serverDetails.allocations[0] 
            : serverDetails.allocations;
          allocationIp = allocation?.attributes?.ip || allocation?.ip || allocation?.attributes?.ip_alias || allocation?.ip_alias;
          allocationPort = allocation?.attributes?.port || allocation?.port || allocation?.attributes?.port_alias || allocation?.port_alias;
        } else if (serverDetails.allocation) {
          // Single allocation object
          const allocation = serverDetails.allocation;
          allocationIp = allocation?.attributes?.ip || allocation?.ip || allocation?.attributes?.ip_alias || allocation?.ip_alias;
          allocationPort = allocation?.attributes?.port || allocation?.port || allocation?.attributes?.port_alias || allocation?.port_alias;
        }

        if (allocationIp && allocationPort) {
          // Construct webhook URL
          const botWebhookUrl = baseUrlPattern
            .replace('<IP>', allocationIp)
            .replace('<PORT>', allocationPort.toString());

          console.log(`🔗 Constructed webhook URL: ${botWebhookUrl} (from ${allocationIp}:${allocationPort})`);

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
    const { data: allServers } = await supabase
      .from('custom_bot_tokens')
      .select('guild_id, bot_webhook_url, runs_on_pterodactyl, pterodactyl_server_uuid')
      .eq('runs_on_pterodactyl', true)
      .not('pterodactyl_server_uuid', 'is', null);

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


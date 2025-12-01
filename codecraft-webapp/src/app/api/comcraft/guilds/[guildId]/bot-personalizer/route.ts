/**
 * API Route: Bot Personalizer
 * /api/comcraft/guilds/[guildId]/bot-personalizer
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getPterodactylClient } from '@/lib/pterodactyl/client';
import { getDeploymentConfig, getServerName } from '@/lib/pterodactyl/tier-config';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

/**
 * Check if bot is online in guild via Discord API
 */
async function checkBotStatus(guildId: string, botApplicationId: string, botToken: string): Promise<{ online: boolean; totalGuilds?: number }> {
  try {
    // First, check if bot is in the guild by fetching guild members
    // Note: This requires the bot to have SERVER MEMBERS INTENT enabled
    const guildResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
      headers: {
        'Authorization': `Bot ${botToken}`
      }
    });

    if (guildResponse.ok) {
      const guildData = await guildResponse.json();
      
      // Check if bot is a member of the guild by checking bot user endpoint
      const botUserResponse = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          'Authorization': `Bot ${botToken}`
        }
      });

      if (botUserResponse.ok) {
        // Try to get bot's guilds to see if it's in this guild
        const botGuildsResponse = await fetch('https://discord.com/api/v10/users/@me/guilds', {
          headers: {
            'Authorization': `Bot ${botToken}`
          }
        });

        if (botGuildsResponse.ok) {
          const botGuilds = await botGuildsResponse.json();
          const isInGuild = botGuilds.some((g: any) => g.id === guildId);
          
          // If bot is in guild, consider it online
          // Note: This is a best-effort check. A real check would require Gateway API
          return {
            online: isInGuild,
            totalGuilds: botGuilds.length
          };
        }
      }
    }

    // If we can't verify, assume offline
    return { online: false };
  } catch (error) {
    console.error('Error checking bot status:', error);
    return { online: false };
  }
}

// GET - Fetch bot personalizer config
export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('custom_bot_tokens')
      .select('*') // We need bot_token to check status, but won't expose it in response
      .eq('guild_id', params.guildId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching bot config:', error);
    }

    if (!data) {
      return NextResponse.json({
        botConfig: null
      });
    }

    // Check bot status if token is available and setup is completed
    let botOnline = data.bot_online || false;
    let totalGuilds = data.total_guilds || 1;
    
    if (data.setup_completed && data.bot_token && data.bot_application_id) {
      try {
        // Check bot status via Discord API
        const status = await checkBotStatus(params.guildId, data.bot_application_id, data.bot_token);
        botOnline = status.online;
        
        if (status.totalGuilds !== undefined) {
          totalGuilds = status.totalGuilds;
        }

        // Update database with latest status (async, don't wait)
        supabase
          .from('custom_bot_tokens')
          .update({
            bot_online: botOnline,
            total_guilds: totalGuilds,
            last_seen: botOnline ? new Date().toISOString() : data.last_seen,
            updated_at: new Date().toISOString()
          })
          .eq('guild_id', params.guildId)
          .then(({ error: updateError }) => {
            if (updateError) {
              console.error('Error updating bot status:', updateError);
            } else {
              console.log(`✅ Updated bot status for guild ${params.guildId}: ${botOnline ? 'online' : 'offline'}`);
            }
          });
      } catch (statusError) {
        console.error('Error checking bot status:', statusError);
        // Continue with existing status if check fails
      }
    }

    // Return config without exposing token
    const { bot_token, ...botConfigWithoutToken } = data;
    
    return NextResponse.json({
      botConfig: {
        ...botConfigWithoutToken,
        bot_online: botOnline,
        total_guilds: totalGuilds
      }
    });
  } catch (error) {
    console.error('Error in bot personalizer API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Enable bot personalizer with custom token
export async function POST(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    const ownerDiscordId = session.user.discordId || session.user.id || session.user.sub;

    // Check if guild has custom branding feature (Premium tier+)
    const { data: config } = await supabase
      .from('guild_configs')
      .select('subscription_tier')
      .eq('guild_id', params.guildId)
      .single();

    const tier = config?.subscription_tier || 'free';
    
    // Get tier features from database
    const { data: tierConfig } = await supabase
      .from('subscription_tiers')
      .select('features')
      .eq('tier_name', tier)
      .eq('is_active', true)
      .single();

    const features = tierConfig?.features || {};
    const hasCustomBranding = features.custom_branding || false;

    if (!hasCustomBranding) {
      return NextResponse.json({ 
        error: 'Premium feature required',
        message: 'Custom Bot Branding is only available starting from the Premium tier.',
        tier: tier,
        requiredTier: 'premium',
        upgradeUrl: 'https://codecraft-solutions.com/products/comcraft'
      }, { status: 403 });
    }

    const body = await request.json();
    const { botToken } = body;

    if (!botToken || !botToken.startsWith('MT') && !botToken.startsWith('MQ')) {
      return NextResponse.json({ 
        error: 'Invalid bot token format' 
      }, { status: 400 });
    }

    // Validate token with Discord API
    const discordResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        'Authorization': `Bot ${botToken}`
      }
    });

    if (!discordResponse.ok) {
      return NextResponse.json({ 
        error: 'Invalid bot token - could not authenticate with Discord' 
      }, { status: 400 });
    }

    const botUser = await discordResponse.json();

    console.log(`✅ Bot Personalizer: Validated bot ${botUser.username}#${botUser.discriminator} for guild ${params.guildId}`);

    // Check if bot is already in the guild
    let botInGuild = false;
    let totalGuilds = 1;
    try {
      const botGuildsResponse = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: {
          'Authorization': `Bot ${botToken}`
        }
      });

      if (botGuildsResponse.ok) {
        const botGuilds = await botGuildsResponse.json();
        botInGuild = botGuilds.some((g: any) => g.id === params.guildId);
        totalGuilds = botGuilds.length;
        
        if (!botInGuild) {
          // Bot is not in guild yet - user needs to invite it
          return NextResponse.json({ 
            error: 'Bot not in guild',
            message: `The bot ${botUser.username} is not in this server yet. Please invite it first using the OAuth2 URL: https://discord.com/oauth2/authorize?client_id=${botUser.id}&permissions=8&scope=bot%20applications.commands`,
            botApplicationId: botUser.id,
            inviteUrl: `https://discord.com/oauth2/authorize?client_id=${botUser.id}&permissions=8&scope=bot%20applications.commands`
          }, { status: 400 });
        }
      }
    } catch (checkError) {
      console.error('Error checking if bot is in guild:', checkError);
      // Continue anyway - might be a temporary issue
    }

    // Store token (should be encrypted in production!)
    const { data, error } = await supabase
      .from('custom_bot_tokens')
      .upsert({
        guild_id: params.guildId,
        owner_discord_id: ownerDiscordId,
        bot_token: botToken, // TODO: Encrypt this!
        bot_application_id: botUser.id,
        bot_username: botUser.username,
        bot_discriminator: botUser.discriminator,
        bot_avatar_url: botUser.avatar 
          ? `https://cdn.discordapp.com/avatars/${botUser.id}/${botUser.avatar}.png`
          : null,
        is_active: botInGuild, // Set to true if bot is in guild
        bot_online: false, // Will be updated by status check
        total_guilds: totalGuilds,
        setup_completed: true,
        last_seen: botInGuild ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'guild_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving bot token:', error);
      return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
    }

    // Check bot status after saving (async, don't wait)
    if (botInGuild) {
      checkBotStatus(params.guildId, botUser.id, botToken)
        .then((status) => {
          supabase
            .from('custom_bot_tokens')
            .update({
              bot_online: status.online,
              total_guilds: status.totalGuilds || totalGuilds,
              last_seen: status.online ? new Date().toISOString() : null,
              updated_at: new Date().toISOString()
            })
            .eq('guild_id', params.guildId)
            .then(({ error: updateError }) => {
              if (updateError) {
                console.error('Error updating bot status after setup:', updateError);
              } else {
                console.log(`✅ Bot status updated for guild ${params.guildId}: ${status.online ? 'online' : 'offline'}`);
              }
            });
        })
        .catch((statusError) => {
          console.error('Error checking bot status after setup:', statusError);
        });
    }

    // Automatically provision Pterodactyl sub-server for custom bot (using Splitter API)
    let pterodactylServer: any = null;
    let provisioningError: string | null = null;
    
    try {
      console.log(`🚀 Starting Pterodactyl sub-server provisioning for guild ${params.guildId}...`);
      
      // Use existing Splitter API client (creates sub-server under parent)
      const client = getPterodactylClient();
      
      // Check if there's already a container for this guild and clean it up first
      const { data: existingConfig } = await supabase
        .from('custom_bot_tokens')
        .select('pterodactyl_server_uuid, pterodactyl_server_id')
        .eq('guild_id', params.guildId)
        .single();
      
      if (existingConfig?.pterodactyl_server_uuid) {
        console.log(`🧹 Cleaning up existing container ${existingConfig.pterodactyl_server_uuid} before creating new one...`);
        try {
          // Stop server first
          try {
            await client.sendPowerAction(existingConfig.pterodactyl_server_uuid, 'stop');
            console.log(`✅ Existing server stopped`);
          } catch (stopError: any) {
            // Ignore 404 - server may already be stopped/deleted
            if (!stopError?.message?.includes('404') && !stopError?.message?.includes('NotFound')) {
              console.warn(`⚠️ Error stopping existing server:`, stopError.message);
            }
          }
          
          // Delete existing server
          try {
            await client.deleteServer(existingConfig.pterodactyl_server_uuid);
            console.log(`✅ Existing server deleted`);
          } catch (deleteError: any) {
            // Ignore 404 - server may already be deleted
            if (!deleteError?.message?.includes('404') && !deleteError?.message?.includes('NotFound')) {
              console.warn(`⚠️ Error deleting existing server:`, deleteError.message);
            }
          }
        } catch (cleanupError: any) {
          console.warn(`⚠️ Error during cleanup (continuing anyway):`, cleanupError.message);
        }
      }
      
      // Get default tier config (starter tier for custom bots)
      const config = getDeploymentConfig('starter', []);
      const serverName = `comcraft-${botUser.username}-${params.guildId.slice(-6)}`.toLowerCase();
      
      // Create server via Pterodactyl API (supports both Splitter API and Application API)
      // The client.createServer() method automatically detects the API mode from PTERODACTYL_API_MODE env var
      // Environment variables are required by the egg and must be provided at server creation
      pterodactylServer = await client.createServer({
        name: serverName,
        cpu: config.resources.cpu_percent, // Integer (25 = 25%)
        memory: config.resources.memory_mb, // Integer MB (512)
        disk: config.resources.disk_mb, // Integer MB (2048)
        egg_id: parseInt(process.env.PTERODACTYL_BOT_EGG_ID || '0'),
        copy_subusers: true, // Only used for Splitter API
        localhost_networking: false, // Only used for Splitter API
        // Environment variables required by the egg (Application API)
        // All required variables must be provided at server creation
        environment: {
          // Bot-specific variables
          DISCORD_BOT_TOKEN: botToken,
          GUILD_ID: params.guildId,
          BOT_APPLICATION_ID: botUser.id,
          DISCORD_CLIENT_ID: botUser.id, // Same as BOT_APPLICATION_ID
          NODE_ENV: 'production',
          // Shared variables from Vercel env (required by egg)
          SUPABASE_URL: process.env.SUPABASE_URL || '',
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
          // Optional AI variables
          ...(process.env.GOOGLE_AI_API_KEY && { GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY }),
          ...(process.env.AI_PRIMARY_PROVIDER && { AI_PRIMARY_PROVIDER: process.env.AI_PRIMARY_PROVIDER }),
          ...(process.env.CLAUDE_MODEL && { CLAUDE_MODEL: process.env.CLAUDE_MODEL }),
          ...(process.env.GEMINI_MODEL && { GEMINI_MODEL: process.env.GEMINI_MODEL }),
          // Twitch environment variables (required by egg)
          TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID || '',
          TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET || '',
          TWITCH_EVENTSUB_SECRET: process.env.TWITCH_EVENTSUB_SECRET || '',
        }
      });

      const apiMode = process.env.PTERODACTYL_API_MODE || 'splitter';
      const serverType = apiMode === 'splitter' ? 'sub-server' : 'standalone server';
      console.log(`✅ Pterodactyl ${serverType} created: ${pterodactylServer.identifier} (${pterodactylServer.uuid})`);

      // Get server details to retrieve allocation (IP:Port) for webhook URL
      let botWebhookUrl: string | null = null;
      try {
        // Wait a bit for server to be fully created
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const serverDetails = await client.getServer(pterodactylServer.uuid);
        console.log(`📋 Server details retrieved for ${pterodactylServer.uuid}`);
        
        // Get allocation (IP:Port) from server details
        // Allocation can be in different formats depending on API mode
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
          // Use container port (3002) instead of allocation port
          // The allocation port is forwarded to the container port in Pterodactyl
          // But we need to use the container port directly for the webhook URL
          const containerPort = parseInt(process.env.CUSTOM_BOT_CONTAINER_PORT || '3002');
          
          // Construct webhook URL using environment variable pattern or default
          const baseUrlPattern = process.env.CUSTOM_BOT_BASE_URL || 'http://<IP>:<PORT>';
          botWebhookUrl = baseUrlPattern
            .replace('<IP>', allocationIp)
            .replace('<PORT>', containerPort.toString());
          
          console.log(`🔗 Constructed bot webhook URL: ${botWebhookUrl} (from ${allocationIp}:${allocationPort} -> container port ${containerPort})`);
        } else {
          console.warn(`⚠️  Could not determine allocation (IP:Port) for server ${pterodactylServer.uuid}`);
          console.log(`   Server details keys:`, Object.keys(serverDetails).join(', '));
          if (serverDetails.relationships) {
            console.log(`   Relationships keys:`, Object.keys(serverDetails.relationships).join(', '));
          }
          // Log a sample of the structure for debugging
          console.log(`   Sample structure:`, JSON.stringify({
            hasRelationships: !!serverDetails.relationships,
            hasAllocations: !!serverDetails.allocations,
            hasAllocation: !!serverDetails.allocation,
            relationshipsKeys: serverDetails.relationships ? Object.keys(serverDetails.relationships) : null
          }, null, 2));
        }
      } catch (serverDetailsError: any) {
        console.warn(`⚠️  Could not get server details for webhook URL:`, serverDetailsError.message);
        // Don't throw - server is created, we just can't set webhook URL yet
        // The URL can be set manually later or on server restart
      }

      // Environment variables are already set during server creation via Application API
      // The Install Script will handle downloading files and installing dependencies
      // We just need to wait for the server to be ready and then start it
      try {
        console.log(`✅ Environment variables already set during server creation`);
        console.log(`   Server UUID: ${pterodactylServer.uuid}`);
        console.log(`   Install Script will automatically clone repo and install dependencies`);
        
        // Wait a bit for server installation to complete
        console.log(`⏳ Waiting for server installation to complete...`);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds for install
        
        // Files are automatically deployed via Install Script in the Egg configuration
        // No need to manually upload files - Install Script handles this
        console.log(`📦 Bot files will be deployed automatically via Install Script`);
        
        console.log(`✅ Environment variables automatically set for custom bot:`);
        console.log(`   Bot-specific:`);
        console.log(`   - DISCORD_BOT_TOKEN: ${botToken.substring(0, 10)}...`);
        console.log(`   - GUILD_ID: ${params.guildId}`);
        console.log(`   - BOT_APPLICATION_ID: ${botUser.id}`);
        console.log(`   - NODE_ENV: production`);
        console.log(`   Shared (from Vercel env vars):`);
        if (process.env.SUPABASE_URL) console.log(`   - SUPABASE_URL: ✅`);
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) console.log(`   - SUPABASE_SERVICE_ROLE_KEY: ✅`);
        if (process.env.CLAUDE_API_KEY) console.log(`   - CLAUDE_API_KEY: ✅`);
        if (process.env.GEMINI_API_KEY) console.log(`   - GEMINI_API_KEY: ✅`);
        if (process.env.ANTHROPIC_API_KEY) console.log(`   - ANTHROPIC_API_KEY: ✅`);
        if (process.env.DISCORD_CLIENT_ID) console.log(`   - DISCORD_CLIENT_ID: ✅`);
      } catch (envError: any) {
        console.warn(`⚠️  Error during server setup:`, envError.message);
        // Don't throw - server is created, just log the error
      }

      // Update database with Pterodactyl server info
      // Set runs_on_pterodactyl = true so CustomBotManager on main bot skips this bot
      const serverUpdateData: any = {
        pterodactyl_server_id: pterodactylServer.id?.toString() || pterodactylServer.identifier,
        pterodactyl_server_uuid: pterodactylServer.uuid,
        server_name: pterodactylServer.name || pterodactylServer.identifier,
        server_started_at: new Date().toISOString(),
        server_logs_url: `${process.env.PTERODACTYL_PANEL_URL || ''}/server/${pterodactylServer.identifier}`,
        runs_on_pterodactyl: true, // Important: Tells CustomBotManager to skip this bot
        updated_at: new Date().toISOString()
      };
      
      // Add webhook URL if we were able to construct it
      if (botWebhookUrl) {
        serverUpdateData.bot_webhook_url = botWebhookUrl;
      }

      // Try to update with server_status
      const { error: updateError } = await supabase
        .from('custom_bot_tokens')
        .update({
          ...serverUpdateData,
          server_status: 'installing'
        })
        .eq('guild_id', params.guildId);

      if (updateError) {
        // If error is about missing column, try without server_status
        if (updateError.code === 'PGRST204' && updateError.message?.includes('server_status')) {
          console.warn('⚠️ server_status column not found, updating without it');
          const { error: fallbackError } = await supabase
            .from('custom_bot_tokens')
            .update(serverUpdateData)
            .eq('guild_id', params.guildId);
          
          if (fallbackError) {
            console.error('❌ Error updating Pterodactyl server info (fallback):', fallbackError);
          } else {
            console.log(`✅ Pterodactyl server info saved to database (without server_status)`);
          }
        } else {
          console.error('❌ Error updating Pterodactyl server info:', updateError);
        }
      } else {
        console.log(`✅ Pterodactyl server info saved to database`);
      }

      // Log event
      await supabase
        .from('bot_container_events')
        .insert({
          guild_id: params.guildId,
          bot_application_id: botUser.id,
          event_type: 'server_created',
          event_data: {
            server_id: pterodactylServer.id?.toString() || pterodactylServer.identifier,
            server_uuid: pterodactylServer.uuid,
            server_name: pterodactylServer.name || pterodactylServer.identifier,
            server_identifier: pterodactylServer.identifier
          },
          message: `Pterodactyl server created successfully for custom bot ${botUser.username}`
        })
        .then(({ error: eventError }) => {
          if (eventError) {
            console.error('❌ Error logging server creation event:', eventError);
          } else {
            console.log(`✅ Server creation event logged`);
          }
        });

      // Attempt to start the server automatically after a delay
      // Note: This requires PTERODACTYL_CLIENT_API_TOKEN to be set in environment variables
      // If not set, the server will need to be started manually via Pterodactyl panel
      console.log(`⏳ Waiting 20 seconds for server installation to complete before attempting to start...`);
      setTimeout(async () => {
        try {
          console.log(`🚀 Attempting to start Pterodactyl server automatically: ${pterodactylServer?.identifier}`);
          
          // Try to get Client API token (from env var or will throw helpful error)
          let clientToken: string;
          try {
            clientToken = await client.createClientApiToken(1); // User ID not needed if using env var
          } catch (tokenError: any) {
            console.warn(`⚠️  Cannot auto-start server: ${tokenError.message}`);
            console.log(`ℹ️  Server created successfully. Please start it manually via Pterodactyl panel:`);
            console.log(`   ${process.env.PTERODACTYL_PANEL_URL || 'N/A'}/server/${pterodactylServer?.identifier}`);
            
            // Log that manual start is required
            await supabase
              .from('bot_container_events')
              .insert({
                guild_id: params.guildId,
                bot_application_id: botUser.id,
                event_type: 'server_ready',
                event_data: {
                  server_id: pterodactylServer?.id?.toString() || pterodactylServer?.identifier,
                  server_identifier: pterodactylServer?.identifier,
                  note: 'Server created successfully - manual start required (Client API token not configured)'
                },
                message: `Server created and ready. Please start manually via Pterodactyl panel.`
              });
            return; // Exit gracefully - not an error
          }
          
          // Use Client API token to start the server
          console.log(`🚀 Starting server ${pterodactylServer.uuid} with Client API token...`);
          await client.startServerWithClientToken(pterodactylServer.uuid, clientToken);
          
          console.log(`✅ Pterodactyl server started successfully: ${pterodactylServer?.identifier}`);
          
          // Update status to 'starting' (only if column exists)
          await supabase
            .from('custom_bot_tokens')
            .update({
              server_status: 'starting',
              updated_at: new Date().toISOString()
            })
            .eq('guild_id', params.guildId);

          // Log start event
          await supabase
            .from('bot_container_events')
            .insert({
              guild_id: params.guildId,
              bot_application_id: botUser.id,
              event_type: 'server_starting',
              event_data: {
                server_id: pterodactylServer?.id?.toString() || pterodactylServer?.identifier
              },
              message: `Pterodactyl server starting automatically for custom bot`
            });
        } catch (startError: any) {
          console.error('❌ Error starting Pterodactyl server automatically:', startError);
          
          // Log error event
          await supabase
            .from('bot_container_events')
            .insert({
              guild_id: params.guildId,
              bot_application_id: botUser.id,
              event_type: 'server_error',
              event_data: {
                server_id: pterodactylServer?.id?.toString() || pterodactylServer?.identifier,
                error: `Failed to start automatically: ${startError.message}`
              },
              message: `Failed to start Pterodactyl server automatically. Please start manually via panel.`
            });
        }
      }, 20000); // Wait 20 seconds before attempting to start

    } catch (provisioningErr: any) {
      console.error('❌ Error provisioning Pterodactyl server:', provisioningErr);
      provisioningError = provisioningErr.message || 'Unknown error';
      
      // Log error event
      await supabase
        .from('bot_container_events')
        .insert({
          guild_id: params.guildId,
          bot_application_id: botUser.id,
          event_type: 'server_error',
          event_data: {
            error: provisioningError
          },
          message: `Failed to provision Pterodactyl server: ${provisioningError}`
        });
    }

    // Build response message
    let message = botInGuild 
      ? 'Bot Personalizer enabled! The bot is in your server.'
      : 'Bot Personalizer enabled! However, the bot is not in your server yet. Please invite it first.';
    
    if (pterodactylServer) {
      message += ' Container has been created and will start automatically.';
    } else if (provisioningError) {
      message += ` Warning: Container creation failed (${provisioningError}). The bot token has been saved, but you may need to manually create a container.`;
    } else {
      message += ' Note: Container creation is in progress. This may take a few minutes.';
    }

    return NextResponse.json({ 
      success: true,
      message: message,
      botInGuild: botInGuild,
      containerCreated: !!pterodactylServer,
      containerError: provisioningError || null,
      botUser: {
        username: botUser.username,
        discriminator: botUser.discriminator,
        avatar: botUser.avatar
      },
      inviteUrl: botInGuild ? null : `https://discord.com/oauth2/authorize?client_id=${botUser.id}&permissions=8&scope=bot%20applications.commands`
    });
  } catch (error) {
    console.error('Error enabling bot personalizer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Disable bot personalizer
export async function DELETE(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current bot config to find Pterodactyl server
    const { data: botConfig } = await supabase
      .from('custom_bot_tokens')
      .select('pterodactyl_server_uuid, bot_application_id')
      .eq('guild_id', params.guildId)
      .single();

    // Stop and delete Pterodactyl sub-server if it exists
    if (botConfig?.pterodactyl_server_uuid) {
      try {
        const client = getPterodactylClient();
        console.log(`🛑 Stopping and deleting Pterodactyl sub-server ${botConfig.pterodactyl_server_uuid}...`);
        
        // Stop server first (ignore 404 - server may already be deleted)
        try {
          await client.sendPowerAction(botConfig.pterodactyl_server_uuid, 'stop');
          console.log(`✅ Sub-server ${botConfig.pterodactyl_server_uuid} stopped`);
        } catch (stopError: any) {
          // 404 means server doesn't exist (already deleted), which is fine
          // sendPowerAction now handles 404 internally, but we'll still log it
          if (stopError?.message?.includes('404') || stopError?.message?.includes('NotFound')) {
            console.log(`ℹ️  Server already deleted or doesn't exist (stop skipped)`);
          } else {
            console.warn(`⚠️ Error stopping sub-server (may already be stopped):`, stopError.message);
            // Don't throw - continue with deletion attempt
          }
        }

        // Delete sub-server via Splitter API (ignore 404 - server may already be deleted)
        try {
          await client.deleteServer(botConfig.pterodactyl_server_uuid);
          console.log(`✅ Sub-server ${botConfig.pterodactyl_server_uuid} deleted`);
        } catch (deleteError: any) {
          // deleteServer now handles 404 internally, but we'll still log it
          if (deleteError?.message?.includes('404') || deleteError?.message?.includes('NotFound')) {
            console.log(`ℹ️  Server already deleted or doesn't exist (delete skipped)`);
          } else {
            // Only log other errors, don't throw - we want to continue with disabling
            console.warn(`⚠️ Error deleting sub-server:`, deleteError.message);
          }
        }

        // Log deletion event
        await supabase
          .from('bot_container_events')
          .insert({
            guild_id: params.guildId,
            bot_application_id: botConfig.bot_application_id,
            event_type: 'server_deleted',
            event_data: {
              server_uuid: botConfig.pterodactyl_server_uuid
            },
            message: `Pterodactyl server deleted for custom bot`
          });

      } catch (serverError: any) {
        console.error('❌ Error cleaning up Pterodactyl server:', serverError);
        
        // Log error but continue with disabling
        await supabase
          .from('bot_container_events')
          .insert({
            guild_id: params.guildId,
            bot_application_id: botConfig?.bot_application_id,
            event_type: 'server_cleanup_error',
            event_data: {
              server_uuid: botConfig?.pterodactyl_server_uuid,
              error: serverError.message
            },
            message: `Failed to cleanup Pterodactyl server: ${serverError.message}`
          });
      }
    }

    // Update database to disable bot
    // Clear Pterodactyl fields and reset runs_on_pterodactyl
    const updateData: any = {
      is_active: false,
      setup_completed: false,
      runs_on_pterodactyl: false, // Reset so CustomBotManager could pick it up if re-enabled
      pterodactyl_server_id: null,
      pterodactyl_server_uuid: null,
      server_name: null,
      updated_at: new Date().toISOString()
    };

    // Only add server_status fields if they exist (check by trying to update)
    // We'll use a safe update that won't fail if columns don't exist
    try {
      // Try to update with server_status fields
      const { error: testError } = await supabase
        .from('custom_bot_tokens')
        .update({
          ...updateData,
          server_status: 'stopped',
          server_stopped_at: new Date().toISOString()
        })
        .eq('guild_id', params.guildId)
        .select('server_status')
        .limit(1);

      // If the error is about missing column, update without it
      if (testError && testError.code === 'PGRST204') {
        console.log('⚠️ server_status column not found, updating without it');
        const { error } = await supabase
          .from('custom_bot_tokens')
          .update(updateData)
          .eq('guild_id', params.guildId);
        
        if (error) {
          console.error('Error disabling bot personalizer:', error);
          return NextResponse.json({ error: 'Failed to disable' }, { status: 500 });
        }
      } else if (testError) {
        // Other error
        console.error('Error disabling bot personalizer:', testError);
        return NextResponse.json({ error: 'Failed to disable' }, { status: 500 });
      }
      // Success - server_status column exists and update worked
    } catch (updateError: any) {
      // Fallback: try without server_status
      console.warn('Error updating with server_status, trying without:', updateError);
      const { error: fallbackError } = await supabase
        .from('custom_bot_tokens')
        .update(updateData)
        .eq('guild_id', params.guildId);
      
      if (fallbackError) {
        console.error('Error disabling bot personalizer:', fallbackError);
        return NextResponse.json({ error: 'Failed to disable' }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Bot personalizer disabled and server cleaned up'
    });
  } catch (error) {
    console.error('Error in delete bot personalizer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


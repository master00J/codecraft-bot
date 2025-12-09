/**
 * API Route: User's Guilds
 * GET /api/comcraft/guilds - Get all guilds where user is owner
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawDiscordId = (session.user as any).discordId;
    if (!rawDiscordId) {
      return NextResponse.json({ error: 'Discord ID not found' }, { status: 400 });
    }

    // Normalize Discord ID to string for consistent comparison
    const discordId = String(rawDiscordId);

    console.log(`[Guilds API] Fetching guilds for user ${discordId} (type: ${typeof rawDiscordId})`);

    // Get all guilds where user is owner
    // Normalize owner_discord_id comparison by fetching all and filtering
    const { data: allGuilds, error: allGuildsError } = await supabase
      .from('guild_configs')
      .select(`
        guild_id,
        guild_name,
        guild_icon_url,
        subscription_tier,
        subscription_active,
        license_id,
        owner_discord_id
      `);

    if (allGuildsError) {
      console.error('Error fetching all guilds:', allGuildsError);
      return NextResponse.json({ error: 'Failed to fetch guilds' }, { status: 500 });
    }

    // Filter owned guilds by normalized Discord ID comparison
    const ownedGuilds = (allGuilds || []).filter(
      (guild: any) => String(guild.owner_discord_id) === discordId
    ).map(({ owner_discord_id, ...rest }: any) => rest); // Remove owner_discord_id from result

    console.log(`[Guilds API] Found ${ownedGuilds.length} owned guilds`);

    // Get all guilds where user is authorized (via guild_authorized_users)
    // Fetch all authorized users for this guild and filter in JavaScript
    const { data: allAuthorizedUsers, error: authError } = await supabase
      .from('guild_authorized_users')
      .select('guild_id, discord_id');

    let authorizedGuildIds: string[] = [];
    if (!authError && allAuthorizedUsers) {
      // Filter by normalized Discord ID comparison
      authorizedGuildIds = allAuthorizedUsers
        .filter((user: any) => String(user.discord_id) === discordId)
        .map((user: any) => user.guild_id);
      
      console.log(`[Guilds API] Found ${authorizedGuildIds.length} authorized guilds for user ${discordId}`);
    } else if (authError) {
      console.warn('Error fetching authorized users:', authError);
    }

    let authorizedGuilds: any[] = [];
    if (authorizedGuildIds.length > 0) {
      const { data: authorizedGuildsData, error: authorizedGuildsError } = await supabase
        .from('guild_configs')
        .select(`
          guild_id,
          guild_name,
          guild_icon_url,
          subscription_tier,
          subscription_active,
          license_id
        `)
        .in('guild_id', authorizedGuildIds);

      if (!authorizedGuildsError && authorizedGuildsData) {
        authorizedGuilds = authorizedGuildsData;
        console.log(`[Guilds API] Loaded ${authorizedGuilds.length} authorized guild configs`);
      } else if (authorizedGuildsError) {
        console.warn('Error fetching authorized guild configs:', authorizedGuildsError);
      }
    }

    // Get all guilds where user is authorized (via authorized_users table - legacy)
    // Try to fetch, but ignore if table doesn't exist
    let legacyAuthorizedGuilds: any[] = [];
    try {
      const { data: allLegacyUsers, error: legacyAuthError } = await supabase
        .from('authorized_users')
        .select('guild_id, user_id');

      if (!legacyAuthError && allLegacyUsers) {
        // Filter by normalized user_id comparison
        const legacyIds = allLegacyUsers
          .filter((user: any) => String(user.user_id) === discordId)
          .map((user: any) => user.guild_id);

        if (legacyIds.length > 0) {
          const { data: legacyGuildsData, error: legacyGuildsError } = await supabase
            .from('guild_configs')
            .select(`
              guild_id,
              guild_name,
              guild_icon_url,
              subscription_tier,
              subscription_active,
              license_id
            `)
            .in('guild_id', legacyIds);

          if (!legacyGuildsError && legacyGuildsData) {
            legacyAuthorizedGuilds = legacyGuildsData;
            console.log(`[Guilds API] Found ${legacyAuthorizedGuilds.length} legacy authorized guilds`);
          }
        }
      }
    } catch (error) {
      // Silently ignore if table doesn't exist
      console.warn('Legacy authorized_users table not available or error:', error);
    }

    // Combine all guilds and deduplicate
    const guildMap = new Map<string, any>();
    
    // Add owned guilds
    (ownedGuilds || []).forEach((guild: any) => {
      guildMap.set(guild.guild_id, guild);
    });

    // Add authorized guilds (new table)
    (authorizedGuilds || []).forEach((guild: any) => {
      if (guild && !guildMap.has(guild.guild_id)) {
        guildMap.set(guild.guild_id, guild);
      }
    });

    // Add authorized guilds (legacy table)
    (legacyAuthorizedGuilds || []).forEach((guild: any) => {
      if (guild && !guildMap.has(guild.guild_id)) {
        guildMap.set(guild.guild_id, guild);
      }
    });

    // Get authorized roles for this user (requires bot API check, but we'll include guilds with authorized roles anyway)
    // Note: We can't check Discord roles server-side without the bot API, so we'll include all guilds
    // where the user might have an authorized role. The actual role check happens in the access control helper.

    const guilds = Array.from(guildMap.values()).sort((a: any, b: any) => 
      (a.guild_name || '').localeCompare(b.guild_name || '')
    );

    console.log(`[Guilds API] Total guilds after combining: ${guilds.length} (${ownedGuilds.length} owned, ${authorizedGuilds.length} authorized, ${legacyAuthorizedGuilds.length} legacy)`);

    // Get all guild IDs for vote tier unlock check
    const guildIds = guilds.map((g: any) => g.guild_id);
    
    // Fetch active vote tier unlocks for these guilds
    // Get all active unlocks, then filter by expiry in code (to handle NULL expires_at)
    const { data: voteUnlocks } = guildIds.length > 0 ? await supabase
      .from('vote_tier_unlocks')
      .select('guild_id, tier_name, expires_at')
      .in('guild_id', guildIds)
      .eq('is_active', true) : { data: null };

    // Create a map of guild_id -> vote tier unlock
    // Filter out expired unlocks (expires_at is NULL or in the future)
    const voteUnlockMap = new Map<string, any>();
    if (voteUnlocks) {
      const now = new Date().getTime();
      voteUnlocks.forEach((unlock: any) => {
        // Include unlock if expires_at is NULL (no expiry) or in the future
        if (!unlock.expires_at || new Date(unlock.expires_at).getTime() > now) {
          voteUnlockMap.set(unlock.guild_id, unlock);
        }
      });
      console.log(`[Guilds API] Found ${voteUnlockMap.size} active vote tier unlocks for ${guildIds.length} guilds`);
    }

    // Fetch license information for guilds that have a license_id
    const guildsWithLicenses = await Promise.all(
      (guilds || []).map(async (guild: any) => {
        let activeLicense = null;
        let effectiveTier = guild.subscription_tier || 'free';
        let isTrial = false;
        
        // Check for vote tier unlock first (takes priority)
        const voteUnlock = voteUnlockMap.get(guild.guild_id);
        if (voteUnlock) {
          effectiveTier = voteUnlock.tier_name;
          isTrial = true; // Vote unlocks are considered "trial"
          console.log(`[Guilds API] Guild ${guild.guild_id} has active vote unlock: ${voteUnlock.tier_name} (TRIAL)`);
        } else if (guild.license_id && guild.subscription_active) {
          // Fetch the license details
          const { data: license, error: licenseError } = await supabase
            .from('comcraft_licenses')
            .select('id, tier, status, expires_at')
            .eq('id', guild.license_id)
            .eq('status', 'active')
            .maybeSingle();

          if (!licenseError && license) {
            // Check if license is expired
            if (license.expires_at) {
              const expires = new Date(license.expires_at).getTime();
              if (Date.now() < expires) {
                activeLicense = {
                  id: license.id,
                  tier: license.tier,
                  status: license.status,
                  expires_at: license.expires_at
                };
                effectiveTier = license.tier;
              }
            } else {
              // No expiry date, license is active
              activeLicense = {
                id: license.id,
                tier: license.tier,
                status: license.status,
                expires_at: null
              };
              effectiveTier = license.tier;
            }
          }
        }

        return {
          ...guild,
          active_license: activeLicense,
          // Use effective tier (vote unlock > license > default)
          subscription_tier: effectiveTier,
          is_trial: isTrial,
          // Feature flags - default to true for now (can be checked via feature gates if needed)
          leveling_enabled: true,
          moderation_enabled: true,
          streaming_enabled: true
        };
      })
    );

    return NextResponse.json({
      success: true,
      guilds: guildsWithLicenses
    });
  } catch (error) {
    console.error('Error in guilds route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

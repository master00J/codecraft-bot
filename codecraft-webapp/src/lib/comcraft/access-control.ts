/**
 * Centralized access control helper for ComCraft guild features
 * Checks owner, authorized users, authorized roles, and platform admin status
 */

import { supabaseAdmin } from '@/lib/supabase/server';

const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:3002';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

async function callBotAPI(endpoint: string, method: string = 'GET', body?: any) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${COMCRAFT_BOT_API}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET!,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Bot API returned ${response.status}: ${response.statusText}`);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Bot API timeout - is the bot running?');
    }
    if (error.message?.includes('ECONNREFUSED') || error.cause?.code === 'ECONNREFUSED') {
      throw new Error('Bot API connection refused - is the bot running?');
    }
    throw error;
  }
}

export async function getGuildAccess(guildId: string, discordId: string) {
  // Check if user is guild owner
  const { data: guild, error: guildError } = await supabaseAdmin
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (guildError || !guild) {
    console.warn(`[Access Control] Guild ${guildId} not found or error:`, guildError);
    return { allowed: false, reason: 'Guild not found' };
  }

  // Normalize both IDs to strings for comparison
  const ownerId = String(guild.owner_discord_id);
  const userId = String(discordId);

  if (ownerId === userId) {
    console.log(`[Access Control] User ${discordId} is owner of guild ${guildId}`);
    return { allowed: true };
  }

  // Check guild_authorized_users table (uses discord_id)
  const { data: authorizedGuild } = await supabaseAdmin
    .from('guild_authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .maybeSingle();

  if (authorizedGuild) {
    return { allowed: true };
  }

  // Check authorized_users table (uses user_id)
  const { data: authorized } = await supabaseAdmin
    .from('authorized_users')
    .select('user_id')
    .eq('guild_id', guildId)
    .eq('user_id', discordId)
    .maybeSingle();

  if (authorized) {
    return { allowed: true };
  }

  // Check if user has an authorized role
  try {
    const { data: authorizedRoles } = await supabaseAdmin
      .from('guild_authorized_roles')
      .select('role_id')
      .eq('guild_id', guildId);

    if (authorizedRoles && authorizedRoles.length > 0) {
      // Check each authorized role via bot API
      for (const { role_id } of authorizedRoles) {
        try {
          const result = await callBotAPI(
            `/api/discord/${guildId}/users/${discordId}/roles/${role_id}`
          );
          if (result.success && result.hasRole) {
            return { allowed: true };
          }
        } catch (error) {
          // Silently continue if bot API is unavailable
          console.warn(`Could not check role ${role_id} for user ${discordId}:`, error);
        }
      }
    }
  } catch (error) {
    // Silently continue if table doesn't exist yet
    console.warn('Could not check authorized roles:', error);
  }

  // Check if user is platform admin
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (user?.is_admin) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Access denied' };
}


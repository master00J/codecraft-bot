/**
 * Admin API: Comcraft guild subscriptions
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

async function ensureAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const discordId = (session.user as any).discordId;

  if (!discordId) {
    return { ok: false, status: 401, error: 'Missing Discord ID on session' };
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .single();

  if (error) {
    console.error('Failed to verify admin user:', error);
    return { ok: false, status: 500, error: 'Failed to verify admin access' };
  }

  if (!user?.is_admin) {
    return { ok: false, status: 403, error: 'Admin access required' };
  }

  return { ok: true } as const;
}

export async function GET() {
  try {
    const check = await ensureAdmin();
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }

    const { data, error } = await supabase
      .from('guild_configs')
      .select(
        'guild_id, guild_name, subscription_tier, subscription_active, subscription_notes, subscription_updated_at, is_active, member_count, owner_discord_id, created_at, updated_at, is_trial, trial_ends_at, license_id'
      )
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions', details: error.message },
        { status: 500 }
      );
    }

    const guilds = data ?? [];

    // Fetch Discord usernames for owners
    const ownerIdsSet = new Set(guilds.map(g => g.owner_discord_id).filter(Boolean));
    const ownerIds = Array.from(ownerIdsSet);
    const ownerMap = new Map<string, string>();

    if (ownerIds.length > 0) {
      try {
        const { data: users } = await supabase
          .from('users')
          .select('discord_id, discord_username, discord_global_name')
          .in('discord_id', ownerIds);

        if (users) {
          users.forEach(user => {
            const displayName = user.discord_global_name || user.discord_username || user.discord_id;
            ownerMap.set(user.discord_id, displayName);
          });
        }
      } catch (userError) {
        console.error('Error fetching user data:', userError);
      }
    }

    // Fetch license information for guilds with licenses
    const licenseIdsSet = new Set(guilds.map(g => g.license_id).filter(Boolean));
    const licenseIds = Array.from(licenseIdsSet);
    const licenseMap = new Map<string, { expires_at: string | null }>();

    if (licenseIds.length > 0) {
      try {
        const { data: licenses } = await supabase
          .from('comcraft_licenses')
          .select('id, expires_at')
          .in('id', licenseIds);

        if (licenses) {
          licenses.forEach(license => {
            licenseMap.set(license.id, { expires_at: license.expires_at });
          });
        }
      } catch (licenseError) {
        console.error('Error fetching license data:', licenseError);
      }
    }

    // Enrich subscriptions with owner usernames and license info
    const enrichedSubscriptions = guilds.map(guild => {
      const licenseInfo = guild.license_id ? licenseMap.get(guild.license_id) : null;
      return {
        ...guild,
        owner_username: guild.owner_discord_id ? ownerMap.get(guild.owner_discord_id) || guild.owner_discord_id : null,
        license_expires_at: licenseInfo?.expires_at || null,
      };
    });

    return NextResponse.json({ success: true, subscriptions: enrichedSubscriptions });
  } catch (error: any) {
    console.error('Unexpected error fetching subscriptions:', error);
    return NextResponse.json(
      { error: 'Unexpected server error', details: error?.message },
      { status: 500 }
    );
  }
}

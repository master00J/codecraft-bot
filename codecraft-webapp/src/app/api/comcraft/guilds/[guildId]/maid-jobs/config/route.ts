import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getGuildAccess(guildId: string, discordId: string) {
  const { data: guild, error: guildError } = await supabaseAdmin
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (guildError || !guild) {
    return { allowed: false, reason: 'Guild not found' };
  }

  if (guild.owner_discord_id === discordId) {
    return { allowed: true };
  }

  const { data: authorized } = await supabaseAdmin
    .from('guild_authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .maybeSingle();

  if (authorized) {
    return { allowed: true };
  }

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

// GET - Fetch maid jobs config
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: config, error } = await supabaseAdmin
      .from('maid_jobs_config')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Config doesn't exist yet
      return NextResponse.json({ config: null });
    }

    if (error) {
      console.error('Error fetching maid jobs config:', error);
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }

    return NextResponse.json({ config });
  } catch (error: any) {
    console.error('Error in GET /api/comcraft/guilds/[guildId]/maid-jobs/config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create or update maid jobs config
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const {
      enabled,
      maid_quarters_channel_id,
      channels_to_clean,
      cleanings_per_role_upgrade,
      cooldown_minutes,
      coins_per_cleaning,
      xp_per_cleaning,
      role_rewards
    } = body;

    if (!maid_quarters_channel_id) {
      return NextResponse.json(
        { error: 'Maid quarters channel is required' },
        { status: 400 }
      );
    }

    // Check if config exists
    const { data: existingConfig } = await supabaseAdmin
      .from('maid_jobs_config')
      .select('id')
      .eq('guild_id', guildId)
      .single();

    let config;
    if (existingConfig) {
      // Update existing
      const { data, error } = await supabaseAdmin
        .from('maid_jobs_config')
        .update({
          enabled: enabled !== undefined ? enabled : true,
          maid_quarters_channel_id,
          channels_to_clean: channels_to_clean || [],
          cleanings_per_role_upgrade: cleanings_per_role_upgrade || 5,
          cooldown_minutes: cooldown_minutes || 5,
          coins_per_cleaning: coins_per_cleaning || 10,
          xp_per_cleaning: xp_per_cleaning || 5,
          role_rewards: role_rewards || {},
          updated_at: new Date().toISOString()
        })
        .eq('guild_id', guildId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      config = data;
    } else {
      // Create new
      const { data, error } = await supabaseAdmin
        .from('maid_jobs_config')
        .insert({
          guild_id: guildId,
          enabled: enabled !== undefined ? enabled : true,
          maid_quarters_channel_id,
          channels_to_clean: channels_to_clean || [],
          cleanings_per_role_upgrade: cleanings_per_role_upgrade || 5,
          cooldown_minutes: cooldown_minutes || 5,
          coins_per_cleaning: coins_per_cleaning || 10,
          xp_per_cleaning: xp_per_cleaning || 5,
          role_rewards: role_rewards || {}
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      config = data;

      // Trigger bot to add default roleplay messages
      try {
        const botUrl = process.env.BOT_INTERNAL_URL || 'http://localhost:3001';
        await fetch(`${botUrl}/internal/maid-jobs/${guildId}/initialize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }).catch(() => {
          // Bot endpoint might not be available
        });
      } catch (error) {
        // Non-critical
      }
    }

    return NextResponse.json({ config });
  } catch (error: any) {
    console.error('Error in POST /api/comcraft/guilds/[guildId]/maid-jobs/config:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}


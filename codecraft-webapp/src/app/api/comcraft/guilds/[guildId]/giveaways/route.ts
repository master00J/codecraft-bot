import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

const supabase = supabaseAdmin;
const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:25836';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

interface SupabaseGiveaway {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string;
  prize: string;
  winner_count: number;
  host_id: string | null;
  host_name: string | null;
  required_role_id: string | null;
  embed_title?: string | null;
  embed_description?: string | null;
  embed_color?: string | null;
  embed_footer?: string | null;
  embed_image_url?: string | null;
  embed_thumbnail_url?: string | null;
  cta_button_label?: string | null;
  cta_button_url?: string | null;
  reward_role_id?: string | null;
  reward_role_remove_after?: number | null;
  reward_dm_message?: string | null;
  reward_channel_id?: string | null;
  reward_channel_message?: string | null;
  entries: string[] | null;
  winners: string[] | null;
  ends_at: string;
  ended: boolean;
  created_at: string;
}

async function assertAccess(guildId: string, discordId: string) {
  const { data: guild } = await supabase
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .single();

  if (guild?.owner_discord_id === discordId) {
    return true;
  }

  const { data: authorized } = await supabase
    .from('guild_authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .single();

  if (authorized) {
    return true;
  }

  const { data: user } = await supabase
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .single();

  if (user?.is_admin) {
    return true;
  }

  return false;
}

async function getTierFeatures(tierName: string) {
  const { data } = await supabase
    .from('subscription_tiers')
    .select('features')
    .eq('tier_name', tierName)
    .eq('is_active', true)
    .single();

  if (data?.features && typeof data.features === 'object') {
    return data.features as Record<string, boolean>;
  }

  const fallback: Record<string, Record<string, boolean>> = {
    free: {
      giveaways: false,
    },
    basic: {
      giveaways: false,
    },
    premium: {
      giveaways: true,
    },
    enterprise: {
      giveaways: true,
    },
  };

  const key = tierName.toLowerCase() as keyof typeof fallback;
  return fallback[key] || fallback.free;
}

async function isGiveawaysEnabled(guildId: string) {
  const now = new Date();
  const { data: licenseRecord } = await supabase
    .from('comcraft_license_guilds')
    .select('license:comcraft_licenses(*)')
    .eq('guild_id', guildId)
    .maybeSingle();

  const rawLicense = licenseRecord?.license;
  const licenseArray = Array.isArray(rawLicense) ? rawLicense : rawLicense ? [rawLicense] : [];
  const activeLicense = licenseArray.find((license) => {
    if (!license) return false;
    if (license.status !== 'active') return false;
    if (!license.expires_at) return true;
    return new Date(license.expires_at) > now;
  });

  if (activeLicense) {
    const features = await getTierFeatures(activeLicense.tier || 'free');
    return !!features.giveaways;
  }

  const { data: guildConfig } = await supabase
    .from('guild_configs')
    .select('subscription_tier, subscription_active')
    .eq('guild_id', guildId)
    .single();

  if (!guildConfig || guildConfig.subscription_active === false) {
    return false;
  }

  const features = await getTierFeatures(guildConfig.subscription_tier || 'free');
  return !!features.giveaways;
}

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
    const discordId = session.user.discordId as string | undefined;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const hasAccess = await assertAccess(params.guildId, discordId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const featureEnabled = await isGiveawaysEnabled(params.guildId);

    const { data, error } = await supabase
      .from('giveaways')
      .select('*')
      .eq('guild_id', params.guildId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading giveaways:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const giveaways = (data || []) as SupabaseGiveaway[];

    return NextResponse.json({
      featureEnabled,
      active: giveaways.filter((item) => !item.ended),
      ended: giveaways.filter((item) => item.ended).slice(0, 25),
    });
  } catch (error) {
    console.error('Giveaways GET failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    if (!INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Internal API secret not configured' }, { status: 500 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    const discordId = session.user.discordId as string | undefined;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const hasAccess = await assertAccess(params.guildId, discordId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const featureEnabled = await isGiveawaysEnabled(params.guildId);
    if (!featureEnabled) {
      return NextResponse.json({ error: 'Giveaways are not enabled for this guild.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      prize,
      durationMinutes,
      channelId,
      winnerCount = 1,
      requiredRoleId = null,
      embedTitle,
      embedDescription,
      embedColor,
      embedFooter,
      embedImageUrl,
      embedThumbnailUrl,
      joinButtonLabel,
      ctaButtonLabel,
      ctaButtonUrl,
      rewardRoleId,
      rewardRoleRemoveAfter,
      rewardDmMessage,
      rewardChannelId,
      rewardChannelMessage,
    } = body || {};

    if (!prize || typeof prize !== 'string') {
      return NextResponse.json({ error: 'Prize is required.' }, { status: 400 });
    }

    const parsedDuration = Number(durationMinutes);
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      return NextResponse.json({ error: 'Duration must be a positive number.' }, { status: 400 });
    }

    if (!channelId || typeof channelId !== 'string') {
      return NextResponse.json({ error: 'Channel is required.' }, { status: 400 });
    }

    const parsedWinners = Number(winnerCount) || 1;
    if (!Number.isFinite(parsedWinners) || parsedWinners < 1 || parsedWinners > 25) {
      return NextResponse.json({ error: 'Winner count must be between 1 and 25.' }, { status: 400 });
    }

    const sanitizedJoinLabel = typeof joinButtonLabel === 'string' && joinButtonLabel.trim().length > 0
      ? joinButtonLabel.trim().slice(0, 40)
      : null;

    const sanitizedButtonLabel = typeof ctaButtonLabel === 'string' && ctaButtonLabel.trim().length > 0
      ? ctaButtonLabel.trim().slice(0, 80)
      : null;

    const sanitizedButtonUrl = typeof ctaButtonUrl === 'string' && ctaButtonUrl.trim().length > 0
      ? ctaButtonUrl.trim()
      : null;

    if (sanitizedButtonUrl && !/^https?:\/\//i.test(sanitizedButtonUrl)) {
      return NextResponse.json({ error: 'Button URL must start with http:// or https://.' }, { status: 400 });
    }

    const rewardRole = typeof rewardRoleId === 'string' && rewardRoleId.trim().length > 0
      ? rewardRoleId.trim()
      : null;

    const rewardRoleDuration = rewardRoleRemoveAfter !== null && rewardRoleRemoveAfter !== undefined
      ? Number(rewardRoleRemoveAfter)
      : null;

    if (rewardRoleDuration !== null && (!Number.isFinite(rewardRoleDuration) || rewardRoleDuration < 0 || rewardRoleDuration > 43200)) {
      return NextResponse.json({ error: 'Reward role removal must be between 0 and 43200 minutes.' }, { status: 400 });
    }

    const rewardChannel = typeof rewardChannelId === 'string' && rewardChannelId.trim().length > 0
      ? rewardChannelId.trim()
      : null;

    const response = await fetch(`${COMCRAFT_BOT_API}/api/giveaways/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET,
      },
      body: JSON.stringify({
        guildId: params.guildId,
        channelId,
        prize,
        durationMinutes: parsedDuration,
        winnerCount: parsedWinners,
        requiredRoleId,
        actorId: discordId,
        actorName: session.user?.name || session.user?.email || 'Dashboard',
        embed: {
          title: typeof embedTitle === 'string' ? embedTitle : undefined,
          description: typeof embedDescription === 'string' ? embedDescription : undefined,
          color: typeof embedColor === 'string' ? embedColor : undefined,
          footer: typeof embedFooter === 'string' ? embedFooter : undefined,
          imageUrl: typeof embedImageUrl === 'string' ? embedImageUrl : undefined,
          thumbnailUrl: typeof embedThumbnailUrl === 'string' ? embedThumbnailUrl : undefined,
          joinButtonLabel: sanitizedJoinLabel || undefined,
          linkLabel: sanitizedButtonLabel || undefined,
          linkUrl: sanitizedButtonUrl || undefined,
        },
        rewards: {
          roleId: rewardRole || undefined,
          roleRemoveAfter: rewardRoleDuration ?? undefined,
          dmMessage: typeof rewardDmMessage === 'string' ? rewardDmMessage : undefined,
          channelId: rewardChannel || undefined,
          channelMessage: typeof rewardChannelMessage === 'string' ? rewardChannelMessage : undefined,
        },
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return NextResponse.json({ error: result.error || 'Failed to start giveaway.' }, { status: response.status || 500 });
    }

    return NextResponse.json({ success: true, giveaway: result.giveaway });
  } catch (error) {
    console.error('Giveaways POST failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

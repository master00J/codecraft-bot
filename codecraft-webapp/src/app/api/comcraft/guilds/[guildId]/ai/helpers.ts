import { supabaseAdmin } from '@/lib/supabase/server';

export const supabase = supabaseAdmin;

const FALLBACK_AI_LIMITS: Record<string, number> = {
  free: 50000,
  basic: 250000,
  premium: 1000000,
  enterprise: -1,
};

function normaliseTier(tier?: string | null) {
  return (tier || 'free').toLowerCase();
}

async function fetchTierLimit(tierName: string) {
  const normalised = normaliseTier(tierName);
  const { data } = await supabase
    .from('subscription_tiers')
    .select('limits')
    .eq('tier_name', tierName)
    .maybeSingle();

  const rawLimit = data?.limits?.ai_tokens_monthly;
  if (rawLimit === undefined || rawLimit === null) {
    return FALLBACK_AI_LIMITS[normalised] ?? -1;
  }

  const limit = Number(rawLimit);
  return Number.isNaN(limit) ? FALLBACK_AI_LIMITS[normalised] ?? -1 : limit;
}

const FALLBACK_SYSTEM_PROMPT_LIMITS: Record<string, number> = {
  free: 6000,
  basic: 10000,
  premium: 15000,
  enterprise: 20000,
};

export async function getSystemPromptLimit(guildId: string): Promise<number> {
  const { data: licenseRecord } = await supabase
    .from('comcraft_license_guilds')
    .select('license:comcraft_licenses(tier)')
    .eq('guild_id', guildId)
    .maybeSingle();

  const license = Array.isArray(licenseRecord?.license)
    ? licenseRecord?.license?.[0]
    : licenseRecord?.license || null;

  let tierName: string;
  
  if (license?.tier) {
    tierName = license.tier;
  } else {
    const { data: guild } = await supabase
      .from('guild_configs')
      .select('subscription_tier')
      .eq('guild_id', guildId)
      .maybeSingle();
    
    tierName = guild?.subscription_tier || 'free';
  }

  const normalised = normaliseTier(tierName);
  const { data } = await supabase
    .from('subscription_tiers')
    .select('limits')
    .eq('tier_name', tierName)
    .maybeSingle();

  const rawLimit = data?.limits?.ai_system_prompt_chars;
  if (rawLimit === undefined || rawLimit === null) {
    return FALLBACK_SYSTEM_PROMPT_LIMITS[normalised] ?? 6000;
  }

  const limit = Number(rawLimit);
  return Number.isNaN(limit) ? FALLBACK_SYSTEM_PROMPT_LIMITS[normalised] ?? 6000 : limit;
}

export async function getGuildAccess(guildId: string, discordId: string) {
  const { data: guild } = await supabase
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .single();

  if (!guild) return { allowed: false };

  const isOwner = guild.owner_discord_id === discordId;

  const { data: authorized } = await supabase
    .from('guild_authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .maybeSingle();

  const { data: user } = await supabase
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .maybeSingle();

  const isPlatformAdmin = user?.is_admin === true;

  return {
    allowed: Boolean(isOwner || authorized || isPlatformAdmin),
  };
}

function fallbackFeatures(tier: string) {
  const defaults: Record<string, Record<string, boolean>> = {
    free: { ai_assistant: false },
    basic: { ai_assistant: false },
    premium: { ai_assistant: true },
    enterprise: { ai_assistant: true },
  };

  return defaults[tier?.toLowerCase?.() || 'free'] || defaults.free;
}

export async function isAiFeatureEnabled(guildId: string) {
  const { data: licenseRecord } = await supabase
    .from('comcraft_license_guilds')
    .select('license:comcraft_licenses(*)')
    .eq('guild_id', guildId)
    .maybeSingle();

  const license = Array.isArray(licenseRecord?.license)
    ? licenseRecord?.license?.[0]
    : licenseRecord?.license || null;

  const tier = license?.tier;

  if (tier) {
    const { data: tierConfig } = await supabase
      .from('subscription_tiers')
      .select('features')
      .eq('tier_name', tier)
      .maybeSingle();

    if (tierConfig?.features && typeof tierConfig.features === 'object') {
      return Boolean((tierConfig.features as Record<string, boolean>).ai_assistant);
    }

    return Boolean(fallbackFeatures(tier).ai_assistant);
  }

  const { data: guild } = await supabase
    .from('guild_configs')
    .select('subscription_tier, subscription_active')
    .eq('guild_id', guildId)
    .single();

  if (!guild || guild.subscription_active === false) {
    return false;
  }

  const tierName = guild.subscription_tier || 'free';

  const { data: tierConfig } = await supabase
    .from('subscription_tiers')
    .select('features')
    .eq('tier_name', tierName)
    .maybeSingle();

  if (tierConfig?.features && typeof tierConfig.features === 'object') {
    return Boolean((tierConfig.features as Record<string, boolean>).ai_assistant);
  }

  return Boolean(fallbackFeatures(tierName).ai_assistant);
}

export async function getAiUsageLimitInfo(guildId: string) {
  const { data: licenseRecord } = await supabase
    .from('comcraft_license_guilds')
    .select('license:comcraft_licenses(tier)')
    .eq('guild_id', guildId)
    .maybeSingle();

  const license = Array.isArray(licenseRecord?.license)
    ? licenseRecord?.license?.[0]
    : licenseRecord?.license || null;

  if (license?.tier) {
    const limit = await fetchTierLimit(license.tier);
    return {
      limitTokens: limit,
      tierName: license.tier,
      source: 'license' as const,
      subscriptionActive: true,
    };
  }

  const { data: guild } = await supabase
    .from('guild_configs')
    .select('subscription_tier, subscription_active')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (!guild || guild.subscription_active === false) {
    const tierName = normaliseTier(guild?.subscription_tier);
    return {
      limitTokens: 0,
      tierName,
      source: 'inactive' as const,
      subscriptionActive: false,
    };
  }

  const tierName = guild.subscription_tier || 'free';
  const limit = await fetchTierLimit(tierName);

  return {
    limitTokens: limit,
    tierName,
    source: 'tier' as const,
    subscriptionActive: true,
  };
}


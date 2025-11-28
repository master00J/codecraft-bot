import { supabaseAdmin } from '@/lib/supabase/server';
import { getTierMaxGuilds, ComcraftTierId } from './tiers';

const supabase = supabaseAdmin;

export interface ComcraftLicense {
  id: string;
  user_id: string;
  tier: ComcraftTierId;
  max_guilds: number;
  status: 'active' | 'expired' | 'cancelled';
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  payment_id: string | null;
}

export interface LicenseWithAssignments extends ComcraftLicense {
  assigned_guilds: Array<{
    guild_id: string;
    guild_name: string | null;
    assigned_at: string;
  }>;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createLicenseForUser(params: {
  userId: string;
  tier: ComcraftTierId;
  paymentId?: string;
  maxGuilds?: number;
  expiresAt?: string | null;
}): Promise<ComcraftLicense> {
  const maxGuilds = params.maxGuilds ?? getTierMaxGuilds(params.tier);

  const { data, error } = await supabase
    .from('comcraft_licenses')
    .insert({
      user_id: params.userId,
      tier: params.tier,
      max_guilds: maxGuilds,
      status: 'active',
      payment_id: params.paymentId ?? null,
      expires_at: params.expiresAt ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    .select()
    .single();

  if (error || !data) {
    console.error('Failed to create license', error);
    throw new Error('Could not create license record');
  }

  return data as ComcraftLicense;
}

export async function getActiveLicenseForGuild(guildId: string): Promise<ComcraftLicense | null> {
  const { data, error } = await supabase
    .from('comcraft_license_guilds')
    .select('license:comcraft_licenses(*)')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch license for guild', guildId, error);
    throw new Error('Could not fetch license for guild');
  }

  if (!data?.license) {
    return null;
  }

  const rawLicense = Array.isArray(data.license) ? data.license[0] : data.license;

  if (!rawLicense) {
    return null;
  }

  const license = rawLicense as ComcraftLicense;
  if (license.status !== 'active') {
    return null;
  }

  if (license.expires_at) {
    const expires = new Date(license.expires_at).getTime();
    if (Date.now() >= expires) {
      return null;
    }
  }

  return license;
}

export async function getActiveLicensesForUser(userId: string): Promise<LicenseWithAssignments[]> {
  const { data, error } = await supabase
    .from('comcraft_licenses')
    .select('*, assignments:comcraft_license_guilds(guild_id, guild_name, assigned_at)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch licenses for user', userId, error);
    throw new Error('Could not fetch licenses');
  }

  return (data ?? []).map((license: any) => ({
    ...(license as ComcraftLicense),
    assigned_guilds: license.assignments ?? [],
  }));
}

export async function releaseLicenseFromGuild(guildId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('comcraft_license_guilds')
    .select('license_id')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (!existing) {
    return;
  }

  const { error: deleteError } = await supabase
    .from('comcraft_license_guilds')
    .delete()
    .eq('guild_id', guildId);

  if (deleteError) {
    console.error('Failed to release license for guild', guildId, deleteError);
    throw new Error('Could not release license from guild');
  }

  const { error: updateConfigError } = await supabase
    .from('guild_configs')
    .update({
      license_id: null,
      subscription_active: false,
      subscription_tier: 'free',
      subscription_updated_at: nowIso(),
    })
    .eq('guild_id', guildId);

  if (updateConfigError) {
    console.error('Failed to reset guild config after releasing license', guildId, updateConfigError);
    throw new Error('Could not update guild config after release');
  }
}

export async function assignLicenseToGuild(licenseId: string, guildId: string, options?: { guildName?: string | null }): Promise<ComcraftLicense> {
  const { data: licenseData, error: licenseError } = await supabase
    .from('comcraft_licenses')
    .select('*')
    .eq('id', licenseId)
    .maybeSingle();

  if (licenseError) {
    console.error('Failed to load license', licenseId, licenseError);
    throw new Error('Could not load license');
  }

  if (!licenseData) {
    throw new Error('License not found');
  }

  const license = licenseData as ComcraftLicense;

  if (license.status !== 'active') {
    throw new Error('Selected license is not active');
  }

  if (license.expires_at) {
    const expires = new Date(license.expires_at).getTime();
    if (Date.now() >= expires) {
      throw new Error('Selected license has expired');
    }
  }

  const { data: existingAssignments, error: assignmentsError } = await supabase
    .from('comcraft_license_guilds')
    .select('guild_id')
    .eq('license_id', licenseId);

  if (assignmentsError) {
    console.error('Failed to count license assignments', licenseId, assignmentsError);
    throw new Error('Could not verify license slots');
  }

  const assignedCount = existingAssignments?.length ?? 0;
  if (assignedCount >= license.max_guilds) {
    throw new Error('License has no available guild slots');
  }

  await releaseLicenseFromGuild(guildId);

  const { error: insertError } = await supabase
    .from('comcraft_license_guilds')
    .insert({
      license_id: licenseId,
      guild_id: guildId,
      guild_name: options?.guildName ?? null,
      assigned_at: nowIso(),
    });

  if (insertError) {
    console.error('Failed to assign guild to license', licenseId, guildId, insertError);
    throw new Error('Could not assign guild to license');
  }

  const { error: updateConfigError } = await supabase
    .from('guild_configs')
    .update({
      license_id: licenseId,
      subscription_active: true,
      subscription_tier: license.tier,
      subscription_updated_at: nowIso(),
    })
    .eq('guild_id', guildId);

  if (updateConfigError) {
    console.error('Failed to update guild config after assigning license', guildId, updateConfigError);
    throw new Error('Could not update guild config');
  }

  return license;
}

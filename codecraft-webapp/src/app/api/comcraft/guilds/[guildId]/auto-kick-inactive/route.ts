/**
 * API Route: Auto Kick Inactive Members
 * /api/comcraft/guilds/[guildId]/auto-kick-inactive
 * Server owners can enable/disable and set the inactivity period (days).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGuildAccess } from '@/lib/comcraft/access-control';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

const MIN_DAYS = 7;
const MAX_DAYS = 365;
const MIN_GRACE_DAYS = 1;
const MAX_GRACE_DAYS = 30;
const DEFAULT_GRACE_DAYS = 7;

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

    const discordId = (session.user as any).discordId || (session.user as any).id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: config, error } = await supabase
      .from('guild_configs')
      .select('auto_kick_inactive_enabled, auto_kick_inactive_days, auto_kick_effective_from, auto_kick_grace_days')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching auto-kick-inactive setting:', error);
      return NextResponse.json({ error: 'Failed to fetch setting' }, { status: 500 });
    }

    const enabled = config?.auto_kick_inactive_enabled ?? false;
    const days = config?.auto_kick_inactive_days ?? null;
    const effectiveFrom = config?.auto_kick_effective_from ?? null;
    const graceDays = config?.auto_kick_grace_days != null ? Number(config.auto_kick_grace_days) : DEFAULT_GRACE_DAYS;

    return NextResponse.json({
      success: true,
      enabled,
      days: days != null ? Number(days) : null,
      effectiveFrom: effectiveFrom || null,
      graceDays,
    });
  } catch (error) {
    console.error('Error in auto-kick-inactive GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discordId = (session.user as any).discordId || (session.user as any).id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { enabled, days, graceDays: bodyGraceDays } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('guild_configs')
      .select('auto_kick_inactive_enabled, auto_kick_inactive_days, auto_kick_grace_days, auto_kick_effective_from')
      .eq('guild_id', guildId)
      .single();

    const wasEnabled = existing?.auto_kick_inactive_enabled === true;
    const currentGraceDays = existing?.auto_kick_grace_days != null
      ? Number(existing.auto_kick_grace_days)
      : DEFAULT_GRACE_DAYS;

    let autoKickDays: number | null = null;
    let autoKickEffectiveFrom: string | null = null;
    let autoKickGraceDays: number = currentGraceDays;
    if (enabled) {
      const daysNum = days != null ? Number(days) : null;
      if (daysNum !== null && (daysNum < MIN_DAYS || daysNum > MAX_DAYS)) {
        return NextResponse.json(
          { error: `days must be between ${MIN_DAYS} and ${MAX_DAYS}` },
          { status: 400 }
        );
      }
      autoKickDays = daysNum ?? existing?.auto_kick_inactive_days ?? 30;
      const graceNum = bodyGraceDays != null ? Number(bodyGraceDays) : null;
      if (graceNum !== null && (graceNum < MIN_GRACE_DAYS || graceNum > MAX_GRACE_DAYS)) {
        return NextResponse.json(
          { error: `graceDays must be between ${MIN_GRACE_DAYS} and ${MAX_GRACE_DAYS}` },
          { status: 400 }
        );
      }
      autoKickGraceDays = graceNum ?? currentGraceDays;
      const startNewGrace = !wasEnabled || bodyGraceDays != null;
      if (startNewGrace) {
        autoKickEffectiveFrom = new Date(Date.now() + autoKickGraceDays * 24 * 60 * 60 * 1000).toISOString();
      } else {
        autoKickEffectiveFrom = existing?.auto_kick_effective_from ?? null;
      }
    }

    const updateData: Record<string, unknown> = {
      auto_kick_inactive_enabled: enabled,
      auto_kick_inactive_days: autoKickDays,
      auto_kick_effective_from: autoKickEffectiveFrom,
      auto_kick_grace_days: enabled ? autoKickGraceDays : null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('guild_configs')
      .update(updateData)
      .eq('guild_id', guildId)
      .select('auto_kick_inactive_enabled, auto_kick_inactive_days, auto_kick_effective_from, auto_kick_grace_days')
      .single();

    if (error) {
      console.error('Error updating auto-kick-inactive setting:', error);
      return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      enabled: data.auto_kick_inactive_enabled,
      days: data.auto_kick_inactive_days != null ? Number(data.auto_kick_inactive_days) : null,
      effectiveFrom: data.auto_kick_effective_from || null,
      graceDays: data.auto_kick_grace_days != null ? Number(data.auto_kick_grace_days) : DEFAULT_GRACE_DAYS,
    });
  } catch (error) {
    console.error('Error in auto-kick-inactive PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

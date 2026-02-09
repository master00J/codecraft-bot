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
      .select('auto_kick_inactive_enabled, auto_kick_inactive_days')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching auto-kick-inactive setting:', error);
      return NextResponse.json({ error: 'Failed to fetch setting' }, { status: 500 });
    }

    const enabled = config?.auto_kick_inactive_enabled ?? false;
    const days = config?.auto_kick_inactive_days ?? null;

    return NextResponse.json({
      success: true,
      enabled,
      days: days != null ? Number(days) : null
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
    const { enabled, days } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
    }

    const updateData: { auto_kick_inactive_enabled: boolean; auto_kick_inactive_days: number | null; updated_at: string } = {
      auto_kick_inactive_enabled: enabled,
      updated_at: new Date().toISOString()
    };

    if (enabled) {
      const daysNum = days != null ? Number(days) : null;
      if (daysNum !== null && (daysNum < MIN_DAYS || daysNum > MAX_DAYS)) {
        return NextResponse.json(
          { error: `days must be between ${MIN_DAYS} and ${MAX_DAYS}` },
          { status: 400 }
        );
      }
      updateData.auto_kick_inactive_days = daysNum ?? 30;
    } else {
      updateData.auto_kick_inactive_days = null;
    }

    const { data, error } = await supabase
      .from('guild_configs')
      .update(updateData)
      .eq('guild_id', guildId)
      .select('auto_kick_inactive_enabled, auto_kick_inactive_days')
      .single();

    if (error) {
      console.error('Error updating auto-kick-inactive setting:', error);
      return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      enabled: data.auto_kick_inactive_enabled,
      days: data.auto_kick_inactive_days != null ? Number(data.auto_kick_inactive_days) : null
    });
  } catch (error) {
    console.error('Error in auto-kick-inactive PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

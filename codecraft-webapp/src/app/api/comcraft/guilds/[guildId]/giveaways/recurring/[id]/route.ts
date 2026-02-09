/**
 * Single recurring giveaway: get, update (enable/disable, interval, next run), delete.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;
const MIN_INTERVAL_HOURS = 1;
const MAX_INTERVAL_HOURS = 8760;

async function assertAccess(guildId: string, discordId: string) {
  const { data: guild } = await supabase
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .single();
  if (guild?.owner_discord_id === discordId) return true;
  const { data: authorized } = await supabase
    .from('guild_authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .single();
  if (authorized) return true;
  const { data: user } = await supabase
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .single();
  return !!user?.is_admin;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const { guildId, id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const discordId = (session.user as { discordId?: string }).discordId;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }
    const hasAccess = await assertAccess(guildId, discordId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('recurring_giveaways')
      .select('*')
      .eq('guild_id', guildId)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Recurring giveaway not found.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('Recurring giveaway GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const { guildId, id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const discordId = (session.user as { discordId?: string }).discordId;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }
    const hasAccess = await assertAccess(guildId, discordId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.enabled === 'boolean') update.enabled = body.enabled;
    if (body.intervalHours != null) {
      const v = Number(body.intervalHours);
      if (!Number.isFinite(v) || v < MIN_INTERVAL_HOURS || v > MAX_INTERVAL_HOURS) {
        return NextResponse.json({ error: `intervalHours must be between ${MIN_INTERVAL_HOURS} and ${MAX_INTERVAL_HOURS}` }, { status: 400 });
      }
      update.interval_hours = v;
    }
    if (body.nextRunAt != null) {
      const t = new Date(body.nextRunAt);
      if (Number.isNaN(t.getTime())) {
        return NextResponse.json({ error: 'Invalid nextRunAt date.' }, { status: 400 });
      }
      update.next_run_at = t.toISOString();
    }

    const { data, error } = await supabase
      .from('recurring_giveaways')
      .update(update)
      .eq('guild_id', guildId)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Recurring giveaway not found or update failed.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, recurring: data });
  } catch (e) {
    console.error('Recurring giveaway PATCH error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const { guildId, id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const discordId = (session.user as { discordId?: string }).discordId;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }
    const hasAccess = await assertAccess(guildId, discordId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { error } = await supabase
      .from('recurring_giveaways')
      .delete()
      .eq('guild_id', guildId)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete recurring giveaway.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Recurring giveaway DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

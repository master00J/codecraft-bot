import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getGuildAccess(guildId: string, discordId: string) {
  const { data: guild, error: guildError } = await supabaseAdmin
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (guildError || !guild) {
    console.error('Guild lookup error:', guildError);
    return { allowed: false, reason: 'Guild not found' };
  }

  if (guild.owner_discord_id === discordId) {
    return { allowed: true };
  }

  const { data: authorized } = await supabaseAdmin
    .from('authorized_users')
    .select('user_id')
    .eq('guild_id', guildId)
    .eq('user_id', discordId)
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

function toInt(value: string | null, fallback: number) {
  const n = parseInt(value || '', 10);
  return Number.isFinite(n) ? n : fallback;
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
    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const userId = url.searchParams.get('user_id');
    const caseId = url.searchParams.get('case_id');

    const limit = Math.min(200, Math.max(1, toInt(url.searchParams.get('limit'), 50)));
    const offset = Math.max(0, toInt(url.searchParams.get('offset'), 0));

    let query = supabaseAdmin
      .from('moderation_appeals')
      .select('*', { count: 'exact' })
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (userId) query = query.eq('user_id', userId);
    if (caseId) query = query.eq('case_id', caseId);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching appeals:', error);
      return NextResponse.json({ error: 'Failed to fetch appeals' }, { status: 500 });
    }

    return NextResponse.json({
      appeals: data || [],
      count: count || 0,
      limit,
      offset
    });
  } catch (error: any) {
    console.error('Appeals GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const { user_id, username, case_id, reason, source } = body || {};

    if (!user_id || !reason) {
      return NextResponse.json({ error: 'user_id and reason are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('moderation_appeals')
      .insert({
        guild_id: guildId,
        case_id: case_id || null,
        user_id,
        username: username || null,
        reason,
        status: 'pending',
        source: source || 'dashboard'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating appeal:', error);
      return NextResponse.json({ error: 'Failed to create appeal' }, { status: 500 });
    }

    return NextResponse.json({ success: true, appeal: data });
  } catch (error: any) {
    console.error('Appeals POST error:', error);
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
    const { appeal_id, status, decision_reason } = body || {};

    if (!appeal_id || !status) {
      return NextResponse.json({ error: 'appeal_id and status are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('moderation_appeals')
      .update({
        status,
        decision_reason: decision_reason || null,
        decided_by: discordId,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('guild_id', guildId)
      .eq('id', appeal_id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error updating appeal:', error);
      return NextResponse.json({ error: 'Failed to update appeal' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Appeal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, appeal: data });
  } catch (error: any) {
    console.error('Appeals PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST: Trigger bot to sync rank nicknames for all members with configured roles.
 * Use when users already had the role before the prefix was set.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;
const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:25836';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

async function checkGuildAccess(guildId: string, discordId: string) {
  const { data: guild } = await supabase
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .single();

  if (!guild) return false;
  if (guild.owner_discord_id === discordId) return true;

  const { data: authorized } = await supabase
    .from('authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('user_id', discordId)
    .maybeSingle();

  if (authorized) return true;

  const { data: user } = await supabase
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .maybeSingle();

  return user?.is_admin === true;
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

    const discordId = (session.user as any).discordId || (session.user as any).id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    if (!(await checkGuildAccess(guildId, discordId))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!COMCRAFT_BOT_API || !INTERNAL_SECRET) {
      return NextResponse.json(
        { error: 'Bot API not configured. Set COMCRAFT_BOT_API_URL and INTERNAL_API_SECRET.' },
        { status: 503 }
      );
    }

    const res = await fetch(`${COMCRAFT_BOT_API}/api/rank-nickname/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET,
      },
      body: JSON.stringify({ guild_id: guildId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || 'Sync failed' },
        { status: res.status >= 400 ? res.status : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      synced: data.synced ?? 0,
      skippedHierarchy: data.skippedHierarchy ?? 0,
    });
  } catch (error: any) {
    console.error('Rank nickname sync API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

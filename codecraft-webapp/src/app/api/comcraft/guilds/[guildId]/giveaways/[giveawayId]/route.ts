import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

const supabase = supabaseAdmin;
const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:25836';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

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

export async function POST(
  request: NextRequest,
  { params }: { params: { guildId: string; giveawayId: string } }
) {
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

    const body = await request.json();
    const { action } = body || {};

    if (action !== 'end' && action !== 'reroll') {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }

    const endpoint = action === 'end' ? 'end' : 'reroll';

    const response = await fetch(`${COMCRAFT_BOT_API}/api/giveaways/${params.giveawayId}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET,
      },
      body: JSON.stringify({
        guildId: params.guildId,
        actorId: discordId,
        actorName: session.user?.name || session.user?.email || 'Dashboard',
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update giveaway.' }, { status: response.status || 500 });
    }

    return NextResponse.json({ success: true, winners: result.winners || [] });
  } catch (error) {
    console.error('Giveaway action failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

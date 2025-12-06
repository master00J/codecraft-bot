/**
 * API Route: Complete feedback submission
 * /api/comcraft/guilds/[guildId]/feedback/submissions/[submissionId]/complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;
const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:25836';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

async function assertAccess(guildId: string, discordId: string) {
  const { data: guild } = await supabase
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .single();

  if (!guild) {
    throw NextResponse.json({ error: 'Guild not found' }, { status: 404 });
  }

  if (guild.owner_discord_id === discordId) {
    return true;
  }

  const { data: authorized } = await supabase
    .from('guild_authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .maybeSingle();

  if (authorized) {
    return true;
  }

  const { data: user } = await supabase
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (user?.is_admin) {
    return true;
  }

  throw NextResponse.json({ error: 'Access denied' }, { status: 403 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; submissionId: string }> }
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

    await assertAccess(params.guildId, discordId);

    if (!INTERNAL_SECRET) {
      console.error('INTERNAL_API_SECRET is not set.');
      return NextResponse.json({ error: 'Internal API secret not configured.' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const note = typeof body.note === 'string' ? body.note : null;

    const moderatorName = session.user?.name || session.user?.email || 'Dashboard moderator';

    const response = await fetch(`${COMCRAFT_BOT_API}/api/feedback/${params.guildId}/submissions/${params.submissionId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET
      },
      body: JSON.stringify({
        moderatorId: discordId,
        moderatorName,
        note
      })
    });

    const result = await response.json().catch(() => ({ error: 'Bot API error' }));

    if (!response.ok) {
      return NextResponse.json({ error: result.error || 'Bot API error' }, { status: response.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error completing feedback submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

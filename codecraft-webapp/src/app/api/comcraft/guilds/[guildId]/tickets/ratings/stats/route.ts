import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

async function assertAccess(guildId: string, discordId: string) {
  const { data: guild } = await supabase
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .single();

  if (!guild) {
    return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
  }

  if (guild.owner_discord_id !== discordId) {
    // Check if user is authorized
    const { data: authorized } = await supabase
      .from('guild_authorized_users')
      .select('role')
      .eq('guild_id', guildId)
      .eq('discord_id', discordId)
      .maybeSingle();

    if (!authorized) {
      // Check if user is admin
      const { data: user } = await supabase
        .from('users')
        .select('is_admin')
        .eq('discord_id', discordId)
        .maybeSingle();

      if (!user?.is_admin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }
  }

  return null;
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

    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const accessError = await assertAccess(guildId, discordId);
    if (accessError) return accessError;

    const { data, error } = await supabase
      .from('ticket_ratings')
      .select('rating')
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error fetching rating stats:', error);
      return NextResponse.json({ error: 'Failed to fetch rating stats' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        average: 0,
        total: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      });
    }

    const total = data.length;
    const sum = data.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / total;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    data.forEach(r => {
      distribution[r.rating as keyof typeof distribution] = (distribution[r.rating as keyof typeof distribution] || 0) + 1;
    });

    return NextResponse.json({
      average: Math.round(average * 10) / 10,
      total,
      distribution
    });
  } catch (error) {
    console.error('Error in ratings stats GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


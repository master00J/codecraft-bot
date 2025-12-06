/**
 * API Route: Leveling configuration
 * /api/comcraft/guilds/[guildId]/leveling
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const supabase = supabaseAdmin;

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


    // Get leveling config
    const { data: config } = await supabase
      .from('leveling_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    // Get level rewards
    const { data: rewards } = await supabase
      .from('level_rewards')
      .select('*')
      .eq('guild_id', guildId)
      .order('level', { ascending: true });

    // Get leaderboard preview
    const { data: leaderboard } = await supabase
      .from('user_levels')
      .select('*')
      .eq('guild_id', guildId)
      .order('xp', { ascending: false })
      .limit(10);

    return NextResponse.json({
      config: config || {},
      rewards: rewards || [],
      leaderboard: leaderboard || []
    });
  } catch (error) {
    console.error('Error in leveling API:', error);
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

    const body = await request.json();

    const { error } = await supabase
      .from('leveling_configs')
      .upsert({
        guild_id: guildId,
        ...body
      }, {
        onConflict: 'guild_id'
      });

    if (error) {
      console.error('Error updating leveling config:', error);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in update leveling API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


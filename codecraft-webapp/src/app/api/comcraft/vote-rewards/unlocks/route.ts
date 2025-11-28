/**
 * API Route: Vote Tier Unlocks
 * GET /api/comcraft/vote-rewards/unlocks - Get user's active unlocks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discordId = (session.user as any).discordId;
    if (!discordId) {
      return NextResponse.json({ error: 'Discord ID not found' }, { status: 400 });
    }

    // Get active unlocks
    const { data: unlocks, error } = await supabase
      .from('vote_tier_unlocks')
      .select('*')
      .eq('discord_user_id', discordId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching unlocks:', error);
      return NextResponse.json({ error: 'Failed to fetch unlocks' }, { status: 500 });
    }

    // Get guild names
    const guildIds = unlocks?.map(u => u.guild_id) || [];
    const { data: guildConfigs } = await supabase
      .from('guild_configs')
      .select('guild_id, guild_name')
      .in('guild_id', guildIds);

    const unlocksWithGuildNames = unlocks?.map(unlock => {
      const guildConfig = guildConfigs?.find(g => g.guild_id === unlock.guild_id);
      return {
        ...unlock,
        guildName: guildConfig?.guild_name || 'Unknown Guild'
      };
    }) || [];

    return NextResponse.json({
      success: true,
      unlocks: unlocksWithGuildNames
    });
  } catch (error) {
    console.error('Error in unlocks route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


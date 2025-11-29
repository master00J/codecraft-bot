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

export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
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

    const { guildId } = params;
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get quest completion statistics
    const { data: completions, error: completionsError } = await supabaseAdmin
      .from('quest_completions')
      .select('quest_id, completed_at')
      .eq('guild_id', params.guildId)
      .order('completed_at', { ascending: false })
      .limit(1000);

    if (completionsError) {
      console.error('Error fetching completions:', completionsError);
    }

    // Get all quests for the guild
    const { data: quests, error: questsError } = await supabaseAdmin
      .from('quests')
      .select('id, name, quest_type, category')
      .eq('guild_id', params.guildId);

    if (questsError) {
      console.error('Error fetching quests:', questsError);
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }

    // Calculate statistics per quest
    const questStats = (quests || []).map(quest => {
      const questCompletions = (completions || []).filter(c => c.quest_id === quest.id);
      return {
        quest_id: quest.id,
        quest_name: quest.name,
        quest_type: quest.quest_type,
        category: quest.category,
        total_completions: questCompletions.length,
        last_completion: questCompletions.length > 0 
          ? questCompletions[0].completed_at 
          : null
      };
    });

    // Calculate overall statistics
    const totalQuests = quests?.length || 0;
    const totalCompletions = completions?.length || 0;
    const activeQuests = quests?.filter(q => q).length || 0;

    // Get completion count per day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentCompletions = (completions || []).filter(c => {
      const completedAt = new Date(c.completed_at);
      return completedAt >= thirtyDaysAgo;
    });

    const dailyCompletions: Record<string, number> = {};
    recentCompletions.forEach(c => {
      const date = new Date(c.completed_at).toISOString().split('T')[0];
      dailyCompletions[date] = (dailyCompletions[date] || 0) + 1;
    });

    return NextResponse.json({
      total_quests: totalQuests,
      active_quests: activeQuests,
      total_completions: totalCompletions,
      quest_stats: questStats,
      daily_completions: dailyCompletions
    });
  } catch (error) {
    console.error('Error in GET /quests/analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


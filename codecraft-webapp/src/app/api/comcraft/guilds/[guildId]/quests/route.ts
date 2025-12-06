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
    const { searchParams } = new URL(request.url);
    const questId = searchParams.get('id');

    if (questId) {
      // Get single quest with progress
      const { data: quest, error } = await supabaseAdmin
        .from('quests')
        .select(`
          *,
          quest_progress(*)
        `)
        .eq('id', questId)
        .eq('guild_id', guildId)
        .single();

      if (error || !quest) {
        return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
      }

      return NextResponse.json({ quest });
    }

    // Get all quests for guild
    const { data: quests, error } = await supabaseAdmin
      .from('quests')
      .select('*')
      .eq('guild_id', guildId)
      .order('category', { ascending: true })
      .order('chain_position', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching quests:', error);
      return NextResponse.json({ error: 'Failed to fetch quests' }, { status: 500 });
    }

    return NextResponse.json({ quests: quests || [] });
  } catch (error) {
    console.error('Error in GET /quests:', error);
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
    const {
      name,
      description,
      emoji,
      category,
      quest_type,
      requirements,
      rewards,
      reset_type,
      reset_time,
      reset_day_of_week,
      enabled,
      visible,
      prerequisite_quest_ids,
      required_level,
      required_roles,
      max_completions,
      completion_cooldown_hours,
      chain_id,
      chain_position,
      difficulty,
      rarity,
      deadline_at,
      time_limit_hours,
      start_date,
      end_date,
      milestones
    } = body;

    // Validate required fields
    if (!name || !quest_type || !requirements || !rewards) {
      return NextResponse.json(
        { error: 'Missing required fields: name, quest_type, requirements, rewards' },
        { status: 400 }
      );
    }

    const { data: quest, error } = await supabaseAdmin
      .from('quests')
      .insert({
        guild_id: guildId,
        name,
        description: description || null,
        emoji: emoji || '📋',
        category: category || 'general',
        quest_type,
        requirements,
        rewards,
        reset_type: reset_type || 'never',
        reset_time: reset_time || null,
        reset_day_of_week: reset_day_of_week || null,
        enabled: enabled !== undefined ? enabled : true,
        visible: visible !== undefined ? visible : true,
        prerequisite_quest_ids: prerequisite_quest_ids || [],
        required_level: required_level || null,
        required_roles: required_roles || [],
        max_completions: max_completions || null,
        completion_cooldown_hours: completion_cooldown_hours || null,
        chain_id: chain_id || null,
        chain_position: chain_position || null,
        difficulty: difficulty || 'normal',
        rarity: rarity || 'common',
        deadline_at: deadline_at || null,
        time_limit_hours: time_limit_hours || null,
        start_date: start_date || null,
        end_date: end_date || null,
        milestones: milestones || []
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating quest:', error);
      return NextResponse.json({ error: 'Failed to create quest' }, { status: 500 });
    }

    return NextResponse.json({ quest }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /quests:', error);
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
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Quest ID is required' }, { status: 400 });
    }

    const { data: quest, error } = await supabaseAdmin
      .from('quests')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('guild_id', guildId)
      .select()
      .single();

    if (error) {
      console.error('Error updating quest:', error);
      return NextResponse.json({ error: 'Failed to update quest' }, { status: 500 });
    }

    if (!quest) {
      return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
    }

    return NextResponse.json({ quest });
  } catch (error) {
    console.error('Error in PATCH /quests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Quest ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('quests')
      .delete()
      .eq('id', id)
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error deleting quest:', error);
      return NextResponse.json({ error: 'Failed to delete quest' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /quests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


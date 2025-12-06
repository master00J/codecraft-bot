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

// GET - Fetch all quest chains for a guild
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

    const { guildId } = params;
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get('id');

    if (chainId) {
      // Get single chain
      const { data: chain, error } = await supabaseAdmin
        .from('quest_chains')
        .select('*')
        .eq('id', chainId)
        .eq('guild_id', guildId)
        .single();

      if (error || !chain) {
        return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
      }

      // Get quests for this chain separately
      const { data: chainQuests } = await supabaseAdmin
        .from('quests')
        .select('id, name, emoji, chain_position')
        .eq('chain_id', chainId)
        .eq('guild_id', guildId)
        .order('chain_position', { ascending: true });

      return NextResponse.json({ 
        chain: {
          ...chain,
          quests: chainQuests || []
        }
      });
    }

    // Get all chains for guild
    const { data: chains, error } = await supabaseAdmin
      .from('quest_chains')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching quest chains:', error);
      return NextResponse.json({ error: 'Failed to fetch chains' }, { status: 500 });
    }

    // Get quests for each chain separately
    const chainsWithQuests = await Promise.all(
      (chains || []).map(async (chain) => {
        const { data: chainQuests } = await supabaseAdmin
          .from('quests')
          .select('id, name, chain_position')
          .eq('chain_id', chain.id)
          .eq('guild_id', guildId)
          .order('chain_position', { ascending: true });

        return {
          ...chain,
          quests: chainQuests || []
        };
      })
    );

    return NextResponse.json({ chains: chainsWithQuests });
  } catch (error) {
    console.error('Error in GET /quests/chains:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new quest chain
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

    const { guildId } = params;
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, emoji, difficulty, reward_bonus, chain_rewards, enabled } = body;

    if (!name) {
      return NextResponse.json({ error: 'Chain name is required' }, { status: 400 });
    }

    // Get quest IDs from request
    const questIds = body.quest_ids || [];

    const { data: chain, error } = await supabaseAdmin
      .from('quest_chains')
      .insert({
        guild_id: guildId,
        name,
        description: description || null,
        emoji: emoji || '🔗',
        difficulty: difficulty || 'normal',
        reward_bonus: reward_bonus || 1.0,
        chain_rewards: chain_rewards || {},
        enabled: enabled !== undefined ? enabled : true,
        total_quests: questIds.length
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating quest chain:', error);
      return NextResponse.json({ error: 'Failed to create chain' }, { status: 500 });
    }

    // Update quests to link them to this chain
    if (questIds.length > 0) {
      for (let i = 0; i < questIds.length; i++) {
        await supabaseAdmin
          .from('quests')
          .update({
            chain_id: chain.id,
            chain_position: i + 1
          })
          .eq('id', questIds[i])
          .eq('guild_id', guildId);
      }
    }

    return NextResponse.json({ chain }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /quests/chains:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update a quest chain
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

    const { guildId } = params;
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { id, quest_ids, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Chain ID is required' }, { status: 400 });
    }

    // If quest_ids provided, update quest assignments
    if (quest_ids && Array.isArray(quest_ids)) {
      // First, remove all quests from this chain
      await supabaseAdmin
        .from('quests')
        .update({ chain_id: null, chain_position: null })
        .eq('chain_id', id)
        .eq('guild_id', guildId);

      // Then add new quests to chain
      for (let i = 0; i < quest_ids.length; i++) {
        await supabaseAdmin
          .from('quests')
          .update({
            chain_id: id,
            chain_position: i + 1
          })
          .eq('id', quest_ids[i])
          .eq('guild_id', guildId);
      }

      updates.total_quests = quest_ids.length;
    }

    const { data: chain, error } = await supabaseAdmin
      .from('quest_chains')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('guild_id', guildId)
      .select()
      .single();

    if (error) {
      console.error('Error updating quest chain:', error);
      return NextResponse.json({ error: 'Failed to update chain' }, { status: 500 });
    }

    if (!chain) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    return NextResponse.json({ chain });
  } catch (error) {
    console.error('Error in PATCH /quests/chains:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a quest chain
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

    const { guildId } = params;
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get('id');

    if (!chainId) {
      return NextResponse.json({ error: 'Chain ID is required' }, { status: 400 });
    }

    // Remove quests from chain before deleting
    await supabaseAdmin
      .from('quests')
      .update({ chain_id: null, chain_position: null })
      .eq('chain_id', chainId)
      .eq('guild_id', guildId);

    // Delete chain
    const { error } = await supabaseAdmin
      .from('quest_chains')
      .delete()
      .eq('id', chainId)
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error deleting quest chain:', error);
      return NextResponse.json({ error: 'Failed to delete chain' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /quests/chains:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


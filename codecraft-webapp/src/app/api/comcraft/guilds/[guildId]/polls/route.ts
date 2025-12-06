import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    .from('guild_authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .maybeSingle();

  if (authorized) {
    return { allowed: true };
  }

  // Check if user is platform admin
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (user?.is_admin) {
    return { allowed: true };
  }

  console.log('Access denied for user', discordId, 'to guild', guildId);
  return { allowed: false, reason: 'Access denied' };
}

// GET - Fetch all polls for a guild
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
    const pollId = searchParams.get('id');
    const status = searchParams.get('status') || 'all'; // all, active, closed

    if (pollId) {
      // Get single poll with options and results
      const { data: poll, error } = await supabaseAdmin
        .from('polls')
        .select(`
          *,
          poll_options(*)
        `)
        .eq('id', pollId)
        .eq('guild_id', guildId)
        .single();

      if (error || !poll) {
        return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
      }

      // Sort options by order
      poll.poll_options = poll.poll_options.sort((a: any, b: any) => a.option_order - b.option_order);

      // Get votes for public polls
      if (poll.voting_type === 'public') {
        const { data: votes } = await supabaseAdmin
          .from('poll_votes')
          .select('*')
          .eq('poll_id', pollId);

        poll.votes = votes || [];
      }

      return NextResponse.json({ poll });
    }

    // Get all polls for guild
    let query = supabaseAdmin
      .from('polls')
      .select(`
        *,
        poll_options(*)
      `)
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: polls, error } = await query;

    if (error) {
      console.error('Error fetching polls:', error);
      return NextResponse.json({ error: 'Failed to fetch polls' }, { status: 500 });
    }

    // Sort options for each poll
    const pollsWithSortedOptions = (polls || []).map((poll: any) => ({
      ...poll,
      poll_options: poll.poll_options.sort((a: any, b: any) => a.option_order - b.option_order)
    }));

    return NextResponse.json({ polls: pollsWithSortedOptions });
  } catch (error: any) {
    console.error('Error in GET /api/comcraft/guilds/[guildId]/polls:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new poll
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
      title,
      description,
      channel_id,
      poll_type,
      voting_type,
      options,
      expires_at,
      allow_change_vote,
      max_votes,
      require_roles,
      weighted_voting,
      reminder_enabled
    } = body;

    if (!title || !channel_id || !options || options.length < 2) {
      return NextResponse.json(
        { error: 'Missing required fields: title, channel_id, and at least 2 options' },
        { status: 400 }
      );
    }

    // Create poll
    const { data: poll, error: pollError } = await supabaseAdmin
      .from('polls')
      .insert({
        guild_id: guildId,
        created_by: discordId,
        title,
        description: description || null,
        channel_id,
        poll_type: poll_type || 'single',
        voting_type: voting_type || 'public',
        allow_change_vote: allow_change_vote !== false,
        max_votes: max_votes || (poll_type === 'multiple' ? options.length : 1),
        expires_at: expires_at || null,
        require_roles: require_roles || [],
        weighted_voting: weighted_voting || {},
        reminder_enabled: reminder_enabled || false,
        status: 'active'
      })
      .select()
      .single();

    if (pollError || !poll) {
      console.error('Error creating poll:', pollError);
      return NextResponse.json({ error: 'Failed to create poll' }, { status: 500 });
    }

    // Create poll options
    const optionRecords = options.map((opt: any, index: number) => ({
      poll_id: poll.id,
      option_text: opt.text || opt,
      emoji: opt.emoji || null,
      option_order: index,
      vote_count: 0
    }));

    const { error: optionsError } = await supabaseAdmin
      .from('poll_options')
      .insert(optionRecords);

    if (optionsError) {
      // Rollback poll creation
      await supabaseAdmin.from('polls').delete().eq('id', poll.id);
      console.error('Error creating poll options:', optionsError);
      return NextResponse.json({ error: 'Failed to create poll options' }, { status: 500 });
    }

    // Fetch complete poll with options
    const { data: completePoll } = await supabaseAdmin
      .from('polls')
      .select(`
        *,
        poll_options(*)
      `)
      .eq('id', poll.id)
      .single();

    // Trigger bot to create poll message (via internal API if available)
    try {
      const botUrl = process.env.BOT_INTERNAL_URL || 'http://localhost:3001';
      await fetch(`${botUrl}/internal/polls/${poll.id}/create-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, pollId: poll.id })
      }).catch(() => {
        // Bot endpoint might not be available, that's ok - poll can be posted manually
        console.log('Bot internal API not available, poll will need to be posted manually');
      });
    } catch (error) {
      // Non-critical - poll is created, just needs manual posting
      console.log('Could not trigger bot to post poll automatically');
    }

    return NextResponse.json({ poll: completePoll });
  } catch (error: any) {
    console.error('Error in POST /api/comcraft/guilds/[guildId]/polls:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update a poll
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
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Poll ID is required' }, { status: 400 });
    }

    // Verify poll belongs to guild
    const { data: existingPoll } = await supabaseAdmin
      .from('polls')
      .select('id, guild_id')
      .eq('id', id)
      .eq('guild_id', guildId)
      .single();

    if (!existingPoll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    // Update poll
    const { data: poll, error } = await supabaseAdmin
      .from('polls')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('guild_id', guildId)
      .select()
      .single();

    if (error) {
      console.error('Error updating poll:', error);
      return NextResponse.json({ error: 'Failed to update poll' }, { status: 500 });
    }

    return NextResponse.json({ poll });
  } catch (error: any) {
    console.error('Error in PATCH /api/comcraft/guilds/[guildId]/polls:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a poll
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
    const pollId = searchParams.get('id');

    if (!pollId) {
      return NextResponse.json({ error: 'Poll ID is required' }, { status: 400 });
    }

    // Verify poll belongs to guild
    const { data: existingPoll } = await supabaseAdmin
      .from('polls')
      .select('id, guild_id')
      .eq('id', pollId)
      .eq('guild_id', guildId)
      .single();

    if (!existingPoll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    // Delete poll (cascade will delete options and votes)
    const { error } = await supabaseAdmin
      .from('polls')
      .delete()
      .eq('id', pollId)
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error deleting poll:', error);
      return NextResponse.json({ error: 'Failed to delete poll' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/comcraft/guilds/[guildId]/polls:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


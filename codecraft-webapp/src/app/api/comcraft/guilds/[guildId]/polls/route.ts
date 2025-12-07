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
    const action = searchParams.get('action'); // export, analytics

    // Handle export requests
    if (pollId && action === 'export') {
      const format = searchParams.get('format') || 'json'; // json, csv

      const { data: poll, error } = await supabaseAdmin
        .from('polls')
        .select(`
          *,
          poll_options(*),
          poll_votes(*)
        `)
        .eq('id', pollId)
        .eq('guild_id', guildId)
        .single();

      if (error || !poll) {
        return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
      }

      // Sort options
      poll.poll_options = poll.poll_options.sort((a: any, b: any) => a.option_order - b.option_order);

      if (format === 'csv') {
        const lines: string[] = [];
        lines.push(`Poll: ${poll.title}`);
        lines.push(`Status: ${poll.status}`);
        lines.push(`Total Voters: ${poll.total_votes || 0}`);
        lines.push(`Created: ${poll.created_at}`);
        lines.push('');
        lines.push('Option, Votes, Percentage');

        const totalWeightedVotes = poll.poll_options.reduce((sum: number, opt: any) => sum + (parseFloat(opt.vote_count) || 0), 0);

        for (const option of poll.poll_options) {
          const voteCount = parseFloat(option.vote_count) || 0;
          const percentage = totalWeightedVotes > 0 
            ? ((voteCount / totalWeightedVotes) * 100).toFixed(2)
            : '0.00';
          
          lines.push(`"${option.option_text}",${voteCount},${percentage}%`);
        }

        if (poll.voting_type === 'public' && poll.poll_votes) {
          lines.push('');
          lines.push('Voter ID, Options Voted, Vote Weight');
          for (const vote of poll.poll_votes) {
            const optionTexts = vote.option_ids
              .map((optId: string) => {
                const opt = poll.poll_options.find((o: any) => o.id === optId);
                return opt ? opt.option_text : 'Unknown';
              })
              .join('; ');
            
            lines.push(`${vote.user_id},"${optionTexts}",${vote.vote_weight || 1.0}`);
          }
        }

        return new NextResponse(lines.join('\n'), {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="poll-${pollId}.csv"`
          }
        });
      } else {
        // JSON format
        const totalWeightedVotes = poll.poll_options.reduce((sum: number, opt: any) => sum + (parseFloat(opt.vote_count) || 0), 0);

        const exportData = {
          poll: {
            id: poll.id,
            title: poll.title,
            description: poll.description,
            status: poll.status,
            poll_type: poll.poll_type,
            voting_type: poll.voting_type,
            total_voters: poll.total_votes || 0,
            total_weighted_votes: totalWeightedVotes,
            created_at: poll.created_at,
            expires_at: poll.expires_at,
            closed_at: poll.closed_at
          },
          options: poll.poll_options.map((opt: any) => {
            const voteCount = parseFloat(opt.vote_count) || 0;
            const percentage = totalWeightedVotes > 0 
              ? (voteCount / totalWeightedVotes) * 100
              : 0;

            return {
              id: opt.id,
              text: opt.option_text,
              emoji: opt.emoji,
              votes: voteCount,
              percentage: parseFloat(percentage.toFixed(2)),
              order: opt.option_order
            };
          })
        };

        if (poll.voting_type === 'public' && poll.poll_votes) {
          exportData.votes = poll.poll_votes.map((vote: any) => ({
            user_id: vote.user_id,
            option_ids: vote.option_ids,
            vote_weight: vote.vote_weight || 1.0,
            voted_at: vote.voted_at
          }));
        }

        return NextResponse.json(exportData);
      }
    }

    // Handle analytics requests
    if (action === 'analytics') {
      const startDate = searchParams.get('start_date');
      const endDate = searchParams.get('end_date');

      let query = supabaseAdmin
        .from('polls')
        .select(`
          *,
          poll_options(*)
        `)
        .eq('guild_id', guildId);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: polls, error } = await query;

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
      }

      const analytics = {
        total_polls: polls?.length || 0,
        active_polls: polls?.filter((p: any) => p.status === 'active').length || 0,
        closed_polls: polls?.filter((p: any) => p.status === 'closed').length || 0,
        total_votes: polls?.reduce((sum: number, p: any) => sum + (p.total_votes || 0), 0) || 0,
        average_votes_per_poll: 0,
        most_popular_polls: [] as any[],
        polls_by_type: {
          single: polls?.filter((p: any) => p.poll_type === 'single').length || 0,
          multiple: polls?.filter((p: any) => p.poll_type === 'multiple').length || 0
        },
        polls_by_voting_type: {
          public: polls?.filter((p: any) => p.voting_type === 'public').length || 0,
          anonymous: polls?.filter((p: any) => p.voting_type === 'anonymous').length || 0
        }
      };

      if (analytics.total_polls > 0) {
        analytics.average_votes_per_poll = parseFloat((analytics.total_votes / analytics.total_polls).toFixed(2));
        
        analytics.most_popular_polls = polls
          .sort((a: any, b: any) => (b.total_votes || 0) - (a.total_votes || 0))
          .slice(0, 5)
          .map((p: any) => ({
            id: p.id,
            title: p.title,
            votes: p.total_votes || 0
          }));
      }

      return NextResponse.json({ analytics });
    }

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


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

// GET - Fetch all templates for a guild
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

    const { data: templates, error } = await supabaseAdmin
      .from('poll_templates')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    return NextResponse.json({ templates: templates || [] });
  } catch (error: any) {
    console.error('Error in GET /api/comcraft/guilds/[guildId]/polls/templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a template from a poll or create new template
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
    const { poll_id, name, description, ...templateData } = body;

    if (poll_id) {
      // Create template from existing poll
      const { data: poll, error: pollError } = await supabaseAdmin
        .from('polls')
        .select(`
          *,
          poll_options(*)
        `)
        .eq('id', poll_id)
        .eq('guild_id', guildId)
        .single();

      if (pollError || !poll) {
        return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
      }

      const { data: template, error } = await supabaseAdmin
        .from('poll_templates')
        .insert({
          guild_id: guildId,
          created_by: discordId,
          name: name || poll.title,
          description: description || null,
          title: poll.title,
          description_text: poll.description,
          poll_type: poll.poll_type,
          voting_type: poll.voting_type,
          default_options: poll.poll_options.map((opt: any) => opt.option_text),
          require_roles: poll.require_roles || [],
          weighted_voting: poll.weighted_voting || {}
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating template:', error);
        return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
      }

      return NextResponse.json({ template });
    } else {
      // Create new template from scratch
      const { title, poll_type, voting_type, default_options } = templateData;

      if (!name || !title || !default_options || default_options.length < 2) {
        return NextResponse.json(
          { error: 'Missing required fields: name, title, and at least 2 default_options' },
          { status: 400 }
        );
      }

      const { data: template, error } = await supabaseAdmin
        .from('poll_templates')
        .insert({
          guild_id: guildId,
          created_by: discordId,
          name,
          description: description || null,
          title,
          description_text: templateData.description_text || null,
          poll_type: poll_type || 'single',
          voting_type: voting_type || 'public',
          default_options,
          require_roles: templateData.require_roles || [],
          weighted_voting: templateData.weighted_voting || {}
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating template:', error);
        return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
      }

      return NextResponse.json({ template });
    }
  } catch (error: any) {
    console.error('Error in POST /api/comcraft/guilds/[guildId]/polls/templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


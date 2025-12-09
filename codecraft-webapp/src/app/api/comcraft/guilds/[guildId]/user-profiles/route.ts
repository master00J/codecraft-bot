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

// GET - Fetch all profile forms for a guild
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

    const { data: forms, error } = await supabaseAdmin
      .from('user_profiles_forms')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching profile forms:', error);
      return NextResponse.json({ error: 'Failed to fetch forms' }, { status: 500 });
    }

    return NextResponse.json({ forms: forms || [] });
  } catch (error: any) {
    console.error('Error in GET /api/comcraft/guilds/[guildId]/user-profiles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new profile form
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
    const { formName, description, channelId, questions, threadNameTemplate } = body;

    if (!formName || !channelId || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: formName, channelId, questions' },
        { status: 400 }
      );
    }

    // Validate questions structure
    for (const question of questions) {
      if (!question.id || !question.text) {
        return NextResponse.json(
          { error: 'Each question must have an id and text' },
          { status: 400 }
        );
      }
      
      const questionType = question.type || 'dropdown';
      
      if (questionType === 'dropdown') {
        if (!Array.isArray(question.options) || question.options.length === 0) {
          return NextResponse.json(
            { error: 'Dropdown questions must have at least one option' },
            { status: 400 }
          );
        }
        for (const option of question.options) {
          if (!option.id || !option.text) {
            return NextResponse.json(
              { error: 'Each option must have an id and text' },
              { status: 400 }
            );
          }
        }
      }
      // Text and number types don't require options
    }

    const { data: form, error } = await supabaseAdmin
      .from('user_profiles_forms')
      .insert({
        guild_id: guildId,
        form_name: formName,
        description: description || null,
        channel_id: channelId,
        questions: questions,
        thread_name_template: threadNameTemplate || '{username} Profile',
        enabled: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating profile form:', error);
      return NextResponse.json({ error: 'Failed to create form' }, { status: 500 });
    }

    return NextResponse.json({ form });
  } catch (error: any) {
    console.error('Error in POST /api/comcraft/guilds/[guildId]/user-profiles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


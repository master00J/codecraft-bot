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

  // Check guild_authorized_users table (uses discord_id)
  const { data: authorizedGuild } = await supabaseAdmin
    .from('guild_authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .maybeSingle();

  if (authorizedGuild) {
    return { allowed: true };
  }

  // Check authorized_users table (uses user_id)
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

// GET - Fetch a specific profile form
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; formId: string }> }
) {
  const { guildId, formId } = await params;

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

    const { data: form, error } = await supabaseAdmin
      .from('user_profiles_forms')
      .select('*')
      .eq('id', formId)
      .eq('guild_id', guildId)
      .single();

    if (error || !form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    return NextResponse.json({ form });
  } catch (error: any) {
    console.error('Error in GET /api/comcraft/guilds/[guildId]/user-profiles/[formId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update a profile form
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; formId: string }> }
) {
  const { guildId, formId } = await params;

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
    const updates: any = {
      updated_at: new Date().toISOString()
    };

    if (body.formName !== undefined) updates.form_name = body.formName;
    if (body.description !== undefined) updates.description = body.description;
    if (body.channelId !== undefined) updates.channel_id = body.channelId;
    if (body.questions !== undefined) {
      // Validate questions structure
      if (!Array.isArray(body.questions) || body.questions.length === 0) {
        return NextResponse.json(
          { error: 'Questions must be a non-empty array' },
          { status: 400 }
        );
      }
      for (const question of body.questions) {
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
      updates.questions = body.questions;
    }
    if (body.threadNameTemplate !== undefined) updates.thread_name_template = body.threadNameTemplate;
    if (body.enabled !== undefined) updates.enabled = body.enabled;

    const { data: form, error } = await supabaseAdmin
      .from('user_profiles_forms')
      .update(updates)
      .eq('id', formId)
      .eq('guild_id', guildId)
      .select()
      .single();

    if (error || !form) {
      return NextResponse.json({ error: 'Failed to update form' }, { status: 500 });
    }

    return NextResponse.json({ form });
  } catch (error: any) {
    console.error('Error in PATCH /api/comcraft/guilds/[guildId]/user-profiles/[formId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a profile form
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; formId: string }> }
) {
  const { guildId, formId } = await params;

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

    const { error } = await supabaseAdmin
      .from('user_profiles_forms')
      .delete()
      .eq('id', formId)
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error deleting profile form:', error);
      return NextResponse.json({ error: 'Failed to delete form' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/comcraft/guilds/[guildId]/user-profiles/[formId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


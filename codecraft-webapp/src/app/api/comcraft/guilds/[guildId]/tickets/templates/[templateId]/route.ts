import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

async function assertAccess(guildId: string, discordId: string) {
  const { data: guild } = await supabase
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .single();

  if (!guild) {
    return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
  }

  if (guild.owner_discord_id !== discordId) {
    // Check if user is authorized
    const { data: authorized } = await supabase
      .from('guild_authorized_users')
      .select('role')
      .eq('guild_id', guildId)
      .eq('discord_id', discordId)
      .maybeSingle();

    if (!authorized) {
      // Check if user is admin
      const { data: user } = await supabase
        .from('users')
        .select('is_admin')
        .eq('discord_id', discordId)
        .maybeSingle();

      if (!user?.is_admin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }
  }

  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; templateId: string }> }
) {

  const { guildId, templateId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const accessError = await assertAccess(guildId, discordId);
    if (accessError) return accessError;

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('discord_id', discordId)
      .single();

    const body = await request.json();
    const updates: any = {
      updated_by: user?.id || null,
      updated_at: new Date().toISOString()
    };

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.subject !== undefined) updates.subject = body.subject;
    if (body.description_text !== undefined) updates.description_text = body.description_text;
    if (body.category_id !== undefined) updates.category_id = body.category_id;
    if (body.variables !== undefined) updates.variables = body.variables;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const { data, error } = await supabase
      .from('ticket_templates')
      .update(updates)
      .eq('id', templateId)
      .eq('guild_id', guildId)
      .select()
      .single();

    if (error) {
      console.error('Error updating template:', error);
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template: data });
  } catch (error) {
    console.error('Error in template PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; templateId: string }> }
) {

  const { guildId, templateId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const accessError = await assertAccess(guildId, discordId);
    if (accessError) return accessError;

    const { error } = await supabase
      .from('ticket_templates')
      .delete()
      .eq('id', templateId)
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error deleting template:', error);
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in template DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


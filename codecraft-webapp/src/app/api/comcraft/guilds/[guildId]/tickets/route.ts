/**
 * API Route: Tickets Management
 * /api/comcraft/guilds/[guildId]/tickets
 */

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
    throw NextResponse.json({ error: 'Guild not found' }, { status: 404 });
  }

  if (guild.owner_discord_id === discordId) {
    return true;
  }

  const { data: authorized } = await supabase
    .from('guild_authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .maybeSingle();

  if (authorized) {
    return true;
  }

  const { data: user } = await supabase
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (user?.is_admin) {
    return true;
  }

  throw NextResponse.json({ error: 'Access denied' }, { status: 403 });
}

/**
 * GET - Fetch tickets and statistics
 */
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

    await assertAccess(params.guildId, discordId);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const categoryId = searchParams.get('categoryId');

    // Build query
    let query = supabase
      .from('tickets')
      .select('*')
      .eq('guild_id', params.guildId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter out deleted tickets by default
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    // Filter out archived tickets by default
    if (!includeArchived) {
      query = query.eq('archived', false);
    }

    if (status && ['open', 'claimed', 'closed', 'resolved'].includes(status)) {
      query = query.eq('status', status);
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data: tickets, error } = await query;

    if (error) {
      console.error('Error fetching tickets:', error);
      return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
    }

    // Get statistics (exclude deleted tickets)
    const { data: stats } = await supabase
      .from('tickets')
      .select('status')
      .eq('guild_id', params.guildId)
      .is('deleted_at', null);

    const statistics = {
      total: stats?.length || 0,
      open: stats?.filter(t => t.status === 'open').length || 0,
      claimed: stats?.filter(t => t.status === 'claimed').length || 0,
      closed: stats?.filter(t => t.status === 'closed' || t.status === 'resolved').length || 0,
    };

    // Get config
    const { data: config } = await supabase
      .from('ticket_config')
      .select('*')
      .eq('guild_id', params.guildId)
      .maybeSingle();

    // Get categories
    const { data: categories } = await supabase
      .from('ticket_categories')
      .select('*')
      .eq('guild_id', params.guildId)
      .order('name', { ascending: true });

    return NextResponse.json({
      tickets: tickets || [],
      statistics,
      config: config || null,
      categories: categories || []
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in tickets GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH - Update ticket configuration
 */
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

    await assertAccess(params.guildId, discordId);

    const body = await request.json();

    // Validate and sanitize input
    const updates: Record<string, any> = {};
    
    if (typeof body.enabled === 'boolean') {
      updates.enabled = body.enabled;
    }
    if (body.supportCategoryId !== undefined) {
      updates.support_category_id = body.supportCategoryId;
    }
    if (body.archiveCategoryId !== undefined) {
      updates.archive_category_id = body.archiveCategoryId;
    }
    if (body.logChannelId !== undefined) {
      updates.log_channel_id = body.logChannelId;
    }
    if (body.transcriptChannelId !== undefined) {
      updates.transcript_channel_id = body.transcriptChannelId;
    }
    if (body.supportRoleId !== undefined) {
      updates.support_role_id = body.supportRoleId;
    }
    if (typeof body.autoCloseHours === 'number' && body.autoCloseHours > 0) {
      updates.auto_close_hours = body.autoCloseHours;
    }
    if (typeof body.maxOpenTicketsPerUser === 'number' && body.maxOpenTicketsPerUser > 0) {
      updates.max_open_tickets_per_user = body.maxOpenTicketsPerUser;
    }
    if (body.welcomeMessage !== undefined) {
      updates.welcome_message = body.welcomeMessage;
    }

    const panelStringFields: Array<[keyof typeof body, string]> = [
      ['panelEmbedTitle', 'panel_embed_title'],
      ['panelEmbedDescription', 'panel_embed_description'],
      ['panelEmbedColor', 'panel_embed_color'],
      ['panelEmbedFooter', 'panel_embed_footer'],
      ['panelEmbedThumbnailUrl', 'panel_embed_thumbnail_url'],
      ['panelEmbedImageUrl', 'panel_embed_image_url'],
      ['panelButtonLabel', 'panel_button_label'],
      ['panelButtonEmoji', 'panel_button_emoji'],
    ];

    for (const [payloadKey, column] of panelStringFields) {
      if (Object.prototype.hasOwnProperty.call(body, payloadKey)) {
        const rawValue = body[payloadKey as keyof typeof body];
        if (rawValue === null || rawValue === undefined || rawValue === '') {
          updates[column] = null;
        } else if (typeof rawValue === 'string') {
          updates[column] = rawValue.trim();
        } else {
          updates[column] = String(rawValue);
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    // Upsert config
    const { error } = await supabase
      .from('ticket_config')
      .upsert({
        guild_id: params.guildId,
        ...updates,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'guild_id'
      });

    if (error) {
      console.error('Error updating ticket config:', error);
      return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in tickets PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


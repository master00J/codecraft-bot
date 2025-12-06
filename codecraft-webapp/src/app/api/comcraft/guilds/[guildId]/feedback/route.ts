/**
 * API Route: Feedback Queue Management
 * /api/comcraft/guilds/[guildId]/feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;
const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:25836';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

const DEFAULT_EMBED_DESCRIPTION = 'Click the button below to submit your sample for feedback.\n\n• Provide a Soundcloud, YouTube, Dropbox... link\n• Optionally add context (genre, type of feedback)\n• Moderators pick submissions in order during feedback sessions';

const cleanString = (value: unknown, fallback: string, max = 45) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length === 0 ? fallback : trimmed.slice(0, max);
};

const cleanLongString = (value: unknown, fallback: string, max = 2048) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length === 0 ? fallback : trimmed.slice(0, max);
};

const optionalString = (value: unknown, max = 2048) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, max);
};

const sanitizeColor = (value: unknown, fallback = '#8B5CF6') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  }
  return fallback;
};

const sanitizeUrl = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.toString();
  } catch {
    return null;
  }
};

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

const sanitizeExtraFields = (fields: any): any[] => {
  if (!Array.isArray(fields)) return [];

  return fields
    .slice(0, 3)
    .map((field) => ({
      id: typeof field?.id === 'string' && field.id.trim().length > 0
        ? field.id
        : (typeof randomUUID === 'function' ? randomUUID() : `field_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
      label: cleanString(field?.label, 'Extra field', 45),
      placeholder: cleanString(field?.placeholder, '', 100),
      required: field?.required === true,
      style: field?.style === 'paragraph' ? 'paragraph' : 'short'
    }));
};

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

    const { data: config } = await supabase
      .from('comcraft_feedback_configs')
      .select('*')
      .eq('guild_id', params.guildId)
      .maybeSingle();

    const { data: pending } = await supabase
      .from('comcraft_feedback_submissions')
      .select('*')
      .eq('guild_id', params.guildId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    const { data: inProgress } = await supabase
      .from('comcraft_feedback_submissions')
      .select('*')
      .eq('guild_id', params.guildId)
      .eq('status', 'in_progress')
      .order('claimed_at', { ascending: true });

    const { data: recentCompleted } = await supabase
      .from('comcraft_feedback_submissions')
      .select('*')
      .eq('guild_id', params.guildId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      config: config || null,
      pending: pending || [],
      inProgress: inProgress || [],
      recentCompleted: recentCompleted || []
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in feedback GET:', error);
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

    await assertAccess(params.guildId, discordId);

    if (!INTERNAL_SECRET) {
      console.error('INTERNAL_API_SECRET is not set.');
      return NextResponse.json({ error: 'Internal API secret not configured.' }, { status: 500 });
    }

    const body = await request.json();
    const channelId = body.channelId as string | undefined;
    const roleId = body.roleId as string | undefined;

    if (!channelId) {
      return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
    }

    const response = await fetch(`${COMCRAFT_BOT_API}/api/feedback/${params.guildId}/setup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET
      },
      body: JSON.stringify({
        channelId,
        roleId: roleId || null,
        createdBy: discordId,
        createdByName: session.user?.name || session.user?.email || 'Dashboard'
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Bot API error' }));
      return NextResponse.json({ error: error.error || 'Bot API error' }, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error updating feedback config:', error);
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

    await assertAccess(params.guildId, discordId);

    const body = await request.json();

    const updates: Record<string, any> = {};
    if (body.modalTitle !== undefined) {
      updates.modal_title = cleanString(body.modalTitle, 'Submit your sample for feedback', 45);
    }
    if (body.modalLinkLabel !== undefined) {
      updates.modal_link_label = cleanString(body.modalLinkLabel, 'Sample link', 45);
    }
    if (body.modalNotesLabel !== undefined) {
      updates.modal_notes_label = body.modalNotesLabel === null
        ? null
        : cleanString(body.modalNotesLabel, 'Feedback request', 45);
    }
    if (typeof body.modalNotesRequired === 'boolean') {
      updates.modal_notes_required = body.modalNotesRequired;
    }
    if (body.extraFields !== undefined) {
      updates.extra_fields = sanitizeExtraFields(body.extraFields);
    }
    if (body.embedTitle !== undefined) {
      updates.queue_embed_title = cleanString(body.embedTitle, '🎧 Sample Feedback Queue', 256);
    }
    if (body.embedDescription !== undefined) {
      updates.queue_embed_description = cleanLongString(body.embedDescription, DEFAULT_EMBED_DESCRIPTION, 2048);
    }
    if (body.embedColor !== undefined) {
      updates.queue_embed_color = sanitizeColor(body.embedColor);
    }
    if (body.embedFooter !== undefined) {
      if (body.embedFooter === null) {
        updates.queue_embed_footer = null;
      } else {
        const footer = optionalString(body.embedFooter, 1024);
        updates.queue_embed_footer = footer;
      }
    }
    if (body.embedThumbnail !== undefined) {
      updates.queue_embed_thumbnail = body.embedThumbnail === null ? null : sanitizeUrl(body.embedThumbnail);
    }
    if (body.embedImage !== undefined) {
      updates.queue_embed_image = body.embedImage === null ? null : sanitizeUrl(body.embedImage);
    }
    if (body.buttonLabel !== undefined) {
      updates.queue_button_label = cleanString(body.buttonLabel, '🎵 Submit Sample', 80);
    }
    if (body.buttonEmoji !== undefined) {
      if (body.buttonEmoji === null) {
        updates.queue_button_emoji = null;
      } else if (typeof body.buttonEmoji === 'string') {
        const emoji = body.buttonEmoji.trim();
        updates.queue_button_emoji = emoji.length === 0 ? null : emoji.slice(0, 32);
      }
    }
    if (body.buttonStyle !== undefined) {
      if (typeof body.buttonStyle === 'string') {
        const style = body.buttonStyle.toLowerCase();
        if (['primary', 'secondary', 'success', 'danger'].includes(style)) {
          updates.queue_button_style = style;
        }
      }
    }
    if (body.notificationChannelId !== undefined) {
      if (body.notificationChannelId === null) {
        updates.notification_channel_id = null;
      } else if (typeof body.notificationChannelId === 'string') {
        const channelId = body.notificationChannelId.trim();
        updates.notification_channel_id = channelId.length === 0 ? null : channelId;
      }
    }
    if (body.notificationPingRole !== undefined) {
      if (body.notificationPingRole === null) {
        updates.notification_ping_role = null;
      } else if (typeof body.notificationPingRole === 'string') {
        const roleId = body.notificationPingRole.trim();
        updates.notification_ping_role = roleId.length === 0 ? null : roleId;
      }
    }
    if (body.notificationMessage !== undefined) {
      if (body.notificationMessage === null) {
        updates.notification_message = null;
      } else if (typeof body.notificationMessage === 'string') {
        const message = body.notificationMessage.trim();
        updates.notification_message = message.length === 0
          ? '🔔 New submission from {{user}} waiting for feedback!'
          : message.slice(0, 500);
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('comcraft_feedback_configs')
      .update(updates)
      .eq('guild_id', params.guildId);

    if (error) {
      console.error('Error updating feedback modal config:', error);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in feedback PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

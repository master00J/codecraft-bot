/**
 * API Route: Update Notifications Settings
 * /api/comcraft/guilds/[guildId]/update-notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

// GET - Get update notifications setting
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

    const { guildId } = params;

    // Get guild config
    const { data: config, error } = await supabase
      .from('guild_configs')
      .select('update_notifications_enabled, update_notification_channel_id, update_notification_types, update_notification_role_ids')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error fetching update notifications setting:', error);
      return NextResponse.json({ error: 'Failed to fetch setting' }, { status: 500 });
    }

    // Default values if not set
    const enabled = config?.update_notifications_enabled ?? true;
    const channelId = config?.update_notification_channel_id || null;
    const types = config?.update_notification_types || ['feature', 'improvement', 'bugfix', 'security', 'breaking'];
    const roleIds = config?.update_notification_role_ids || [];

    return NextResponse.json({
      success: true,
      enabled,
      channelId,
      types,
      roleIds
    });
  } catch (error) {
    console.error('Error in update notifications API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update update notifications setting
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

    const { guildId } = params;
    const body = await request.json();
    const { enabled, channelId, types, roleIds } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Validate types array if provided
    if (types && !Array.isArray(types)) {
      return NextResponse.json({ error: 'types must be an array' }, { status: 400 });
    }

    // Validate roleIds array if provided
    if (roleIds && !Array.isArray(roleIds)) {
      return NextResponse.json({ error: 'roleIds must be an array' }, { status: 400 });
    }

    // Build update object
    const updateData: any = {
      guild_id: guildId,
      update_notifications_enabled: enabled,
      updated_at: new Date().toISOString()
    };

    if (channelId !== undefined) {
      updateData.update_notification_channel_id = channelId || null;
    }

    if (types !== undefined) {
      updateData.update_notification_types = types;
    }

    if (roleIds !== undefined) {
      updateData.update_notification_role_ids = roleIds;
    }

    // Upsert guild config
    const { data, error } = await supabase
      .from('guild_configs')
      .upsert(updateData, {
        onConflict: 'guild_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating update notifications setting:', error);
      return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      enabled: data.update_notifications_enabled,
      channelId: data.update_notification_channel_id,
      types: data.update_notification_types || ['feature', 'improvement', 'bugfix', 'security', 'breaking'],
      roleIds: data.update_notification_role_ids || []
    });
  } catch (error) {
    console.error('Error in update notifications API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


/**
 * API Route: Cam-Only Voice Configuration
 * /api/comcraft/guilds/[guildId]/cam-only-voice
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

// GET - Fetch cam-only voice configuration
export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: config, error } = await supabase
      .from('cam_only_voice_config')
      .select('*')
      .eq('guild_id', params.guildId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching cam-only voice config:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Return default config if not found
    if (!config) {
      return NextResponse.json({
        config: {
          guild_id: params.guildId,
          enabled: false,
          channel_ids: [],
          grace_period_seconds: 10,
          warning_enabled: true,
          max_warnings: 2,
          exempt_roles: [],
          exempt_users: [],
          log_channel_id: null
        }
      });
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error in cam-only voice API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update cam-only voice configuration
export async function PATCH(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Check if config exists
    const { data: existingConfig } = await supabase
      .from('cam_only_voice_config')
      .select('id')
      .eq('guild_id', params.guildId)
      .single();

    const updateData: any = {
      enabled: body.enabled !== undefined ? body.enabled : false,
      channel_ids: body.channel_ids || [],
      grace_period_seconds: body.grace_period_seconds !== undefined ? body.grace_period_seconds : 10,
      warning_enabled: body.warning_enabled !== undefined ? body.warning_enabled : true,
      max_warnings: body.max_warnings !== undefined ? body.max_warnings : 2,
      exempt_roles: body.exempt_roles || [],
      exempt_users: body.exempt_users || [],
      log_channel_id: body.log_channel_id || null,
      updated_at: new Date().toISOString()
    };

    let config;
    if (existingConfig) {
      // Update existing config
      const { data, error } = await supabase
        .from('cam_only_voice_config')
        .update(updateData)
        .eq('guild_id', params.guildId)
        .select()
        .single();

      if (error) {
        console.error('Error updating cam-only voice config:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      config = data;
    } else {
      // Create new config
      const { data, error } = await supabase
        .from('cam_only_voice_config')
        .insert({
          guild_id: params.guildId,
          ...updateData
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating cam-only voice config:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      config = data;
    }

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Error updating cam-only voice config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logActivity } from '@/lib/activity-logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;

    // Check if user has access to this guild
    const { data: userGuilds } = await supabaseAdmin
      .from('user_guilds')
      .select('guild_id')
      .eq('user_id', session.user.id)
      .eq('guild_id', guildId);

    if (!userGuilds || userGuilds.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get config
    const { data: config, error } = await supabaseAdmin
      .from('application_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching application config:', error);
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }

    return NextResponse.json({ config: config || null });
  } catch (error) {
    console.error('Error in application-config GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;

    // Check if user has access to this guild
    const { data: userGuilds } = await supabaseAdmin
      .from('user_guilds')
      .select('guild_id')
      .eq('user_id', session.user.id)
      .eq('guild_id', guildId);

    if (!userGuilds || userGuilds.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      channel_id, 
      questions, 
      enabled, 
      min_age, 
      cooldown_days, 
      require_account_age_days, 
      auto_thread,
      ping_role_id 
    } = body;

    if (!channel_id || !questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upsert config
    const { data: config, error } = await supabaseAdmin
      .from('application_configs')
      .upsert({
        guild_id: guildId,
        channel_id,
        questions,
        enabled: enabled ?? true,
        min_age: min_age ?? 0,
        cooldown_days: cooldown_days ?? 7,
        require_account_age_days: require_account_age_days ?? 0,
        auto_thread: auto_thread ?? false,
        ping_role_id: ping_role_id ?? null,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving application config:', error);
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }

    // Log activity
    await logActivity(
      guildId,
      session.user.id,
      'application_config_updated',
      'Updated staff application configuration'
    );

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error in application-config POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

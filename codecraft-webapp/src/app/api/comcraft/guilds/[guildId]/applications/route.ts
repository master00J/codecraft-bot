import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

const supabase = supabaseAdmin;

/**
 * Log activity to database
 */
async function logActivity(guildId: string, userId: string, action: string, details: string) {
  try {
    await supabase.from('activity_logs').insert({
      guild_id: guildId,
      user_id: userId,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

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
    const userId = session.user?.id || session.user?.sub || 'unknown';

    // Check if user has access to this guild
    const { data: userGuilds } = await supabase
      .from('user_guilds')
      .select('guild_id')
      .eq('user_id', userId)
      .eq('guild_id', guildId);

    if (!userGuilds || userGuilds.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Get applications
    let query = supabase
      .from('applications')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: applications, error } = await query;

    if (error) {
      console.error('Error fetching applications:', error);
      return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 });
    }

    return NextResponse.json({ applications: applications || [] });
  } catch (error) {
    console.error('Error in applications GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user?.id || session.user?.sub || 'unknown';
    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId');
    const guildId = searchParams.get('guildId');

    if (!applicationId || !guildId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Check if user has access to this guild
    const { data: userGuilds } = await supabase
      .from('user_guilds')
      .select('guild_id')
      .eq('user_id', userId)
      .eq('guild_id', guildId);

    if (!userGuilds || userGuilds.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the application
    const { error } = await supabase
      .from('applications')
      .delete()
      .eq('id', applicationId)
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error deleting application:', error);
      return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 });
    }

    // Log activity
    await logActivity(
      guildId,
      userId,
      'application_deleted',
      `Deleted application ${applicationId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in applications DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

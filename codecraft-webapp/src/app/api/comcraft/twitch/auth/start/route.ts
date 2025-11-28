import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

/**
 * Start Twitch OAuth Flow
 * Generates a state token and redirects user to Twitch authorization
 */

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const notificationId = searchParams.get('notification_id');
    const guildId = searchParams.get('guild_id');

    if (!notificationId || !guildId) {
      return NextResponse.json(
        { error: 'Missing notification_id or guild_id' },
        { status: 400 }
      );
    }

    // Verify notification exists and belongs to this guild
    const { data: notification, error: notificationError } = await supabaseAdmin
      .from('stream_notifications')
      .select('id, guild_id, platform')
      .eq('id', notificationId)
      .eq('guild_id', guildId)
      .eq('platform', 'twitch')
      .single();

    if (notificationError || !notification) {
      return NextResponse.json(
        { error: 'Notification not found or access denied' },
        { status: 404 }
      );
    }

    // Generate random state for CSRF protection
    const state = randomBytes(32).toString('hex');

    // Store state in database
    const { error: stateError } = await supabaseAdmin
      .from('twitch_oauth_states')
      .insert({
        state,
        notification_id: notificationId,
        guild_id: guildId,
      });

    if (stateError) {
      console.error('Error storing OAuth state:', stateError);
      return NextResponse.json(
        { error: 'Failed to initialize OAuth flow' },
        { status: 500 }
      );
    }

    // Clean up expired states (older than 10 minutes)
    await supabaseAdmin
      .from('twitch_oauth_states')
      .delete()
      .lt('expires_at', new Date().toISOString());

    // Build Twitch authorization URL
    const clientId = process.env.TWITCH_CLIENT_ID;
    
    // Get base URL from request headers
    const host = request.headers.get('host') || 'codecraft-solutions.com';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const redirectUri = `${baseUrl}/api/comcraft/twitch/callback`;
    
    const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
    authUrl.searchParams.set('client_id', clientId!);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'channel:read:subscriptions user:read:email');
    authUrl.searchParams.set('state', state);

    console.log('🔑 Starting Twitch OAuth flow');
    console.log('   Guild:', guildId);
    console.log('   Notification:', notificationId);
    console.log('   State:', state.substring(0, 10) + '...');
    console.log('   Redirect URI:', redirectUri);
    console.log('   Base URL:', baseUrl);
    console.log('   Auth URL:', authUrl.toString());

    // Redirect to Twitch
    return NextResponse.redirect(authUrl.toString());
  } catch (error: any) {
    console.error('Error starting OAuth flow:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


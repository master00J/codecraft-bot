import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Twitch OAuth Callback
 * Handles OAuth code exchange and stores tokens in database
 */

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Get base URL from request headers (defined outside try/catch for error handling)
  const host = request.headers.get('host') || 'codecraft-solutions.com';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;
  
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Check if there's an error from Twitch
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    if (error) {
      console.error('❌ Twitch OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `${baseUrl}/en/comcraft/dashboard?error=twitch_auth_failed&message=${encodeURIComponent(errorDescription || error)}`
      );
    }

    // Get code and state from Twitch
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      console.error('❌ Missing code or state parameter');
      return NextResponse.redirect(
        `${baseUrl}/en/comcraft/dashboard?error=missing_parameters`
      );
    }

    // Verify state token (CSRF protection)
    const { data: oauthState, error: stateError } = await supabaseAdmin
      .from('twitch_oauth_states')
      .select('*')
      .eq('state', state)
      .single();

    if (stateError || !oauthState) {
      console.error('❌ Invalid or expired OAuth state');
      return NextResponse.redirect(
        `${baseUrl}/en/comcraft/dashboard?error=invalid_state`
      );
    }

    // Check if state is expired (10 minutes)
    const expiresAt = new Date(oauthState.expires_at);
    if (expiresAt < new Date()) {
      console.error('❌ OAuth state expired');
      await supabaseAdmin
        .from('twitch_oauth_states')
        .delete()
        .eq('state', state);
      
      return NextResponse.redirect(
        `${baseUrl}/en/comcraft/dashboard?error=state_expired`
      );
    }

    console.log('✅ State verified');
    console.log('   Notification:', oauthState.notification_id);
    console.log('   Guild:', oauthState.guild_id);

    // Exchange code for access token
    const redirectUri = `${baseUrl}/api/comcraft/twitch/callback`;
    console.log('🔄 Exchanging code for tokens...');
    console.log('   Redirect URI:', redirectUri);
    console.log('   Base URL:', baseUrl);
    
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID!,
        client_secret: process.env.TWITCH_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('❌ Token exchange failed:', tokenResponse.status, errorData);
      throw new Error(`Twitch token exchange failed: ${tokenResponse.status} - ${errorData}`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    console.log('✅ Tokens received from Twitch');
    console.log('   Expires in:', expires_in, 'seconds');

    // Get Twitch user info
    const userResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID!,
        'Authorization': `Bearer ${access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error(`Twitch user info fetch failed: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    const twitchUser = userData.data[0];
    
    console.log('✅ Twitch user info received');
    console.log('   User ID:', twitchUser.id);
    console.log('   Display Name:', twitchUser.display_name);
    console.log('   Login:', twitchUser.login);

    // Calculate token expiration
    const expiresAtDate = new Date(Date.now() + expires_in * 1000);

    // Update notification with Twitch tokens
    const { error: updateError } = await supabaseAdmin
      .from('stream_notifications')
      .update({
        twitch_user_id: twitchUser.id,
        twitch_access_token: access_token,
        twitch_refresh_token: refresh_token,
        twitch_token_expires_at: expiresAtDate.toISOString(),
        twitch_connected_at: new Date().toISOString(),
        twitch_display_name: twitchUser.display_name,
        streamer_id: twitchUser.id,
        streamer_name: twitchUser.login,
      })
      .eq('id', oauthState.notification_id);

    if (updateError) {
      console.error('❌ Error storing tokens:', updateError);
      return NextResponse.redirect(
        `${baseUrl}/en/comcraft/dashboard?error=database_error`
      );
    }

    console.log('✅ Tokens stored in database');

    // Delete used state
    await supabaseAdmin
      .from('twitch_oauth_states')
      .delete()
      .eq('state', state);

    // Redirect back to dashboard with success
    return NextResponse.redirect(
      `${baseUrl}/en/comcraft/dashboard/${oauthState.guild_id}/streaming?success=twitch_connected&streamer=${twitchUser.display_name}`
    );
  } catch (error: any) {
    console.error('❌ Error in OAuth callback:', error.message);
    return NextResponse.redirect(
      `${baseUrl}/en/comcraft/dashboard?error=oauth_failed&message=${encodeURIComponent(error.message)}`
    );
  }
}

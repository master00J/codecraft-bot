/**
 * GitHub Webhook Handler
 * Automatically updates all Pterodactyl bot servers when code is pushed to GitHub
 * 
 * Setup:
 * 1. Go to GitHub repo → Settings → Webhooks → Add webhook
 * 2. Payload URL: https://codecraft-solutions.com/api/webhooks/github
 * 3. Content type: application/json
 * 4. Secret: (set GITHUB_WEBHOOK_SECRET in Vercel)
 * 5. Events: Just the push event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getPterodactylClient } from '@/lib/pterodactyl/client';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

/**
 * Verify GitHub webhook signature
 */
function verifyGitHubSignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  
  const hmac = createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  // Constant-time comparison to prevent timing attacks
  if (signature.length !== digest.length) return false;
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ digest.charCodeAt(i);
  }
  return result === 0;
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('❌ GITHUB_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    
    // Verify signature
    if (!verifyGitHubSignature(rawBody, signature, webhookSecret)) {
      console.error('❌ Invalid GitHub webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse the payload
    const payload = JSON.parse(rawBody);
    
    // Check if this is a push event
    const event = request.headers.get('x-github-event');
    if (event !== 'push') {
      console.log(`ℹ️ Ignoring GitHub event: ${event}`);
      return NextResponse.json({ message: `Ignored event: ${event}` });
    }

    // Check if push is to main branch
    const branch = payload.ref?.replace('refs/heads/', '');
    if (branch !== 'main' && branch !== 'master') {
      console.log(`ℹ️ Ignoring push to branch: ${branch}`);
      return NextResponse.json({ message: `Ignored branch: ${branch}` });
    }

    // Check if this is the bot repository
    const repoName = payload.repository?.name;
    const expectedRepo = process.env.GITHUB_BOT_REPO_NAME || 'codecraft-bot';
    
    if (repoName !== expectedRepo) {
      console.log(`ℹ️ Ignoring push to repo: ${repoName} (expected: ${expectedRepo})`);
      return NextResponse.json({ message: `Ignored repo: ${repoName}` });
    }

    console.log(`🔔 GitHub webhook received: push to ${repoName}/${branch}`);
    console.log(`   Commit: ${payload.head_commit?.message || 'No message'}`);
    console.log(`   By: ${payload.pusher?.name || 'Unknown'}`);

    // Get all active Pterodactyl servers
    const { data: servers, error: dbError } = await supabase
      .from('custom_bot_tokens')
      .select('guild_id, pterodactyl_server_uuid, bot_username, runs_on_pterodactyl')
      .eq('runs_on_pterodactyl', true)
      .not('pterodactyl_server_uuid', 'is', null);

    if (dbError) {
      console.error('❌ Error fetching servers from database:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!servers || servers.length === 0) {
      console.log('ℹ️ No Pterodactyl servers to update');
      return NextResponse.json({ message: 'No servers to update', updated: 0 });
    }

    console.log(`📦 Found ${servers.length} Pterodactyl server(s) to update`);

    // Update each server
    const client = getPterodactylClient();
    const results: { guild_id: string; status: string; error?: string }[] = [];

    for (const server of servers) {
      try {
        console.log(`🔄 Updating server for guild ${server.guild_id} (${server.bot_username})...`);
        
        // Send command to pull latest code and restart
        // The server will execute: git pull && npm install --production
        await client.sendCommand(server.pterodactyl_server_uuid, 'git pull origin main');
        
        // Wait a bit for git pull to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Restart the server to apply updates
        await client.sendPowerAction(server.pterodactyl_server_uuid, 'restart');
        
        console.log(`✅ Server for guild ${server.guild_id} update triggered`);
        results.push({ guild_id: server.guild_id, status: 'updated' });

        // Log event
        await supabase
          .from('bot_container_events')
          .insert({
            guild_id: server.guild_id,
            event_type: 'auto_update',
            event_data: {
              commit: payload.head_commit?.id?.substring(0, 7),
              message: payload.head_commit?.message,
              pusher: payload.pusher?.name
            },
            message: `Auto-update triggered by GitHub push: ${payload.head_commit?.message?.substring(0, 50)}`
          });

      } catch (serverError: any) {
        console.error(`❌ Error updating server for guild ${server.guild_id}:`, serverError.message);
        results.push({ guild_id: server.guild_id, status: 'error', error: serverError.message });
      }
    }

    const successful = results.filter(r => r.status === 'updated').length;
    const failed = results.filter(r => r.status === 'error').length;

    console.log(`📊 Update complete: ${successful} successful, ${failed} failed`);

    return NextResponse.json({
      message: 'Webhook processed',
      commit: payload.head_commit?.id?.substring(0, 7),
      branch,
      updated: successful,
      failed,
      results
    });

  } catch (error: any) {
    console.error('❌ Error processing GitHub webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint for testing/health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'GitHub webhook endpoint is ready',
    configured: !!process.env.GITHUB_WEBHOOK_SECRET
  });
}


/**
 * API Route: Discord Threads in a Channel
 * /api/comcraft/guilds/[guildId]/discord/channels/[channelId]/threads
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:3002';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

async function callBotAPI(endpoint: string, method: string = 'GET', body?: any) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  if (!COMCRAFT_BOT_API || COMCRAFT_BOT_API === 'http://localhost:3002') {
    console.warn('[Threads API] COMCRAFT_BOT_API_URL is not set or is localhost. Set it in Vercel environment variables.');
  }
  
  if (!INTERNAL_SECRET) {
    console.warn('[Threads API] INTERNAL_API_SECRET is not set. Set it in Vercel environment variables.');
  }

  try {
    const url = `${COMCRAFT_BOT_API}${endpoint}`;
    console.log(`[Threads API] Calling bot API: ${url}`);
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET || '',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Threads API] Bot API returned ${response.status}: ${errorText}`);
      throw new Error(`Bot API returned ${response.status}: ${response.statusText}`);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Threads API] Request timeout');
      throw new Error('Bot API timeout - is the bot running?');
    }
    if (error.message?.includes('ECONNREFUSED') || error.cause?.code === 'ECONNREFUSED') {
      console.error(`[Threads API] Connection refused to ${COMCRAFT_BOT_API}. Make sure COMCRAFT_BOT_API_URL is set correctly in Vercel.`);
      throw new Error(`Bot API connection refused - check COMCRAFT_BOT_API_URL environment variable (currently: ${COMCRAFT_BOT_API || 'not set'})`);
    }
    throw error;
  }
}

// GET - Fetch all threads in a channel
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; channelId: string }> }
) {
  const { guildId, channelId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Threads API] Fetching threads for channel ${channelId} in guild ${guildId}`);
    const result = await callBotAPI(`/api/discord/${guildId}/channels/${channelId}/threads`);
    console.log(`[Threads API] Bot API response:`, result);
    
    // Ensure threads is always an array
    if (result.success && !Array.isArray(result.threads)) {
      result.threads = [];
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching threads:', error);
    
    // If bot API is unavailable, return success with empty array
    // This prevents the UI from breaking and allows channels to still be selectable
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('timeout') || error.message?.includes('Bot API') || error.message?.includes('connection refused')) {
      console.warn('[Threads API] Bot API unavailable, returning empty threads array');
      return NextResponse.json({ 
        success: true,  // Return success so UI doesn't break
        threads: [],
        warning: 'Bot API unavailable - threads cannot be loaded at this time'
      });
    }
    
    // For other errors, also return success with empty array to prevent UI breakage
    return NextResponse.json({ 
      success: true,
      threads: [],
      error: error.message || 'Unknown error'
    });
  }
}


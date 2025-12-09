/**
 * API Route: Discord Channel Management
 * /api/comcraft/guilds/[guildId]/discord/channels
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:3002';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

async function callBotAPI(endpoint: string, method: string = 'GET', body?: any) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  if (!COMCRAFT_BOT_API || COMCRAFT_BOT_API === 'http://localhost:3002') {
    console.error('[Channels API] COMCRAFT_BOT_API_URL is not set or is localhost. Set it in Vercel environment variables.');
  }
  
  if (!INTERNAL_SECRET) {
    console.error('[Channels API] INTERNAL_API_SECRET is not set. Set it in Vercel environment variables.');
  }

  try {
    const url = `${COMCRAFT_BOT_API}${endpoint}`;
    console.log(`[Channels API] Calling bot API: ${url}`);
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET || ''
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Channels API] Bot API returned ${response.status}: ${errorText}`);
      throw new Error(`Bot API returned ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Channels API] Request timeout');
      throw new Error('Bot API timeout - is the bot running?');
    }
    // Re-throw with more context
    if (error.message?.includes('ECONNREFUSED') || error.cause?.code === 'ECONNREFUSED') {
      console.error(`[Channels API] Connection refused to ${COMCRAFT_BOT_API}. Make sure COMCRAFT_BOT_API_URL is set correctly in Vercel.`);
      throw new Error(`Bot API connection refused - check COMCRAFT_BOT_API_URL environment variable (currently: ${COMCRAFT_BOT_API || 'not set'})`);
    }
    throw error;
  }
}

// GET - Fetch all channels
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

    const result = await callBotAPI(`/api/discord/${guildId}/channels`);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Channels API] Error fetching channels:', error);
    
    // If bot API is unavailable, return success with empty channels to prevent UI breakage
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('timeout') || error.message?.includes('Bot API') || error.message?.includes('connection refused')) {
      console.warn('[Channels API] Bot API unavailable, returning empty channels object');
      return NextResponse.json({ 
        success: true,  // Return success so UI doesn't break
        channels: { text: [], voice: [], categories: [] },
        warning: 'Bot API unavailable - channels cannot be loaded at this time'
      });
    }
    
    // For other errors, also return success with empty channels to prevent UI breakage
    return NextResponse.json({ 
      success: true,
      channels: { text: [], voice: [], categories: [] },
      error: error.message || 'Unknown error'
    });
  }
}

// POST - Create new channel
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

    const body = await request.json();
    
    // Add createdBy info
    // @ts-ignore
    body.createdBy = session.user.name || 'Admin';

    const result = await callBotAPI(`/api/discord/${guildId}/channels`, 'POST', body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating channel:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


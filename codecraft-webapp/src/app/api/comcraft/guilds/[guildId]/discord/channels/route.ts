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

  try {
    const response = await fetch(`${COMCRAFT_BOT_API}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET!
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Bot API returned ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Bot API timeout - is the bot running?');
    }
    // Re-throw with more context
    if (error.message?.includes('ECONNREFUSED') || error.cause?.code === 'ECONNREFUSED') {
      throw new Error('Bot API connection refused - is the bot running?');
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

    const result = await callBotAPI(`/api/discord/${params.guildId}/channels`);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching channels:', error);
    
    // If bot API is unavailable, return empty object instead of error
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('timeout') || error.message?.includes('Bot API')) {
      return NextResponse.json({ 
        success: false, 
        channels: {},
        error: 'Bot API unavailable - channels cannot be loaded at this time'
      });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    const result = await callBotAPI(`/api/discord/${params.guildId}/channels`, 'POST', body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating channel:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


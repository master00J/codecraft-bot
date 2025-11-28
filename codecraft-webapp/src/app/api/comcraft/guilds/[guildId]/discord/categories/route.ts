/**
 * API Route: Discord Categories
 * /api/comcraft/guilds/[guildId]/discord/categories
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
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Bot API timeout - is the bot running?');
    }
    throw error;
  }
}

// GET - Fetch all categories (channels with type 4)
export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await callBotAPI(`/api/discord/${params.guildId}/channels`);
    
    // The result structure is: { success: true, channels: { all: [], categories: [], text: [], voice: [] } }
    // Or: { success: false, error: '...' }
    if (!result.success || !result.channels) {
      return NextResponse.json({ 
        categories: [],
        error: result.error || 'Failed to fetch channels' 
      });
    }
    
    // Use the categories array directly, or filter from all channels if categories array is empty
    const categories = result.channels.categories || 
      (result.channels.all || []).filter((channel: any) => channel.type === 4);
    
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


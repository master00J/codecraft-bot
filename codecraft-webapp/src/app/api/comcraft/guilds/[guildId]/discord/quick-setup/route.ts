/**
 * API Route: Quick Setup Wizards
 * /api/comcraft/guilds/[guildId]/discord/quick-setup
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:3002';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

// POST - Run quick setup wizard
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
    const { type } = body; // 'leveling', 'streaming', 'moderation', 'welcome'
    
    // @ts-ignore
    const createdBy = session.user.name || 'Admin';

    const response = await fetch(`${COMCRAFT_BOT_API}/api/discord/${guildId}/quick-setup/${type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET!
      },
      body: JSON.stringify({ createdBy })
    });

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in quick setup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


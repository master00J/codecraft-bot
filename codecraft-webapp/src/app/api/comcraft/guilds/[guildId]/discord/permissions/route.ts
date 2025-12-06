/**
 * API Route: Check Bot Permissions
 * /api/comcraft/guilds/[guildId]/discord/permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:3002';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

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

    const response = await fetch(`${COMCRAFT_BOT_API}/api/discord/${params.guildId}/permissions`, {
      headers: {
        'X-Internal-Secret': INTERNAL_SECRET!
      }
    });

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking permissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


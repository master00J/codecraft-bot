import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGuildAccess } from '@/lib/comcraft/access-control';

export const dynamic = 'force-dynamic';

/**
 * Check if the current user has access to a specific guild dashboard
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      console.error('[Access Route] No Discord ID in session:', session.user);
      return NextResponse.json({ allowed: false, reason: 'No Discord ID in session' }, { status: 400 });
    }

    const { guildId } = await params;
    console.log(`[Access Route] Checking access for user ${discordId} to guild ${guildId}`);
    const access = await getGuildAccess(guildId, discordId);

    if (!access.allowed) {
      console.warn(`[Access Route] Access denied for user ${discordId} to guild ${guildId}: ${access.reason}`);
    } else {
      console.log(`[Access Route] Access granted for user ${discordId} to guild ${guildId}`);
    }

    return NextResponse.json({
      allowed: access.allowed,
      reason: access.reason,
    });
  } catch (error: any) {
    console.error('Error checking guild access:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


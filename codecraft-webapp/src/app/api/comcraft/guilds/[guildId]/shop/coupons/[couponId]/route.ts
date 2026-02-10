/**
 * Single shop coupon: delete (no PATCH for simplicity).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getGuildAccess } from '@/lib/comcraft/access-control';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string; couponId: string }> }
) {
  const { guildId, couponId } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const discordId = (session.user as any).discordId || session.user.id || (session.user as any).sub;
    if (!discordId) return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { error } = await supabaseAdmin
      .from('guild_shop_coupons')
      .delete()
      .eq('guild_id', guildId)
      .eq('id', couponId);

    if (error) {
      console.error('Shop coupon delete error:', error);
      return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Shop coupon DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

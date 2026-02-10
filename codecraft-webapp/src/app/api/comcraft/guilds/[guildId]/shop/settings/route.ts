/**
 * Shop store-front settings: name, description, color, logo, footer.
 * GET / PATCH - requires guild access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getGuildAccess } from '@/lib/comcraft/access-control';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discordId = (session.user as any).discordId || session.user.id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('guild_shop_settings')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (error) {
      console.error('Shop settings fetch error:', error);
      return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
    }

    const settings = data ?? {
      guild_id: guildId,
      store_name: null,
      store_description: null,
      store_primary_color: '#5865F2',
      store_logo_url: null,
      store_footer_text: null,
    };

    return NextResponse.json(settings);
  } catch (e) {
    console.error('Shop settings GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discordId = (session.user as any).discordId || session.user.id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const update: Record<string, unknown> = {
      guild_id: guildId,
      updated_at: new Date().toISOString(),
    };

    if (typeof body.storeName === 'string') update.store_name = body.storeName.trim() || null;
    if (typeof body.storeDescription === 'string') update.store_description = body.storeDescription.trim() || null;
    if (typeof body.storePrimaryColor === 'string') update.store_primary_color = body.storePrimaryColor.trim() || '#5865F2';
    if (typeof body.storeLogoUrl === 'string') update.store_logo_url = body.storeLogoUrl.trim() || null;
    if (typeof body.storeFooterText === 'string') update.store_footer_text = body.storeFooterText.trim() || null;
    if (body.trustBadges !== undefined) update.trust_badges_json = Array.isArray(body.trustBadges) ? body.trustBadges : null;
    if (body.testimonials !== undefined) update.testimonials_json = Array.isArray(body.testimonials) ? body.testimonials : null;
    if (typeof body.termsUrl === 'string') update.terms_url = body.termsUrl.trim() || null;
    if (typeof body.refundPolicyUrl === 'string') update.refund_policy_url = body.refundPolicyUrl.trim() || null;
    if (typeof body.termsContent === 'string') update.terms_content = body.termsContent.trim() || null;
    if (typeof body.refundPolicyContent === 'string') update.refund_policy_content = body.refundPolicyContent.trim() || null;
    if (typeof body.currencyDisclaimer === 'string') update.currency_disclaimer = body.currencyDisclaimer.trim() || null;

    const { data, error } = await supabaseAdmin
      .from('guild_shop_settings')
      .upsert(update, { onConflict: 'guild_id' })
      .select()
      .single();

    if (error) {
      console.error('Shop settings update error:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('Shop settings PATCH error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

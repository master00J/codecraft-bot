/**
 * Create Stripe Customer Portal session for managing subscription (cancel, update payment).
 * Returns { url }. Requires user to have an active subscription so we can get Stripe customer id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getGuildAccess } from '@/lib/comcraft/access-control';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const discordId = (session.user as any).discordId || session.user.id || (session.user as any).sub;
    if (!discordId) return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const returnUrl = typeof body.returnUrl === 'string' ? body.returnUrl.trim() : '';
    const baseUrl = process.env.NEXTAUTH_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const defaultReturn = `${baseUrl}/comcraft/store/${guildId}`;

    const { data: stripeConfig, error: configError } = await supabaseAdmin
      .from('guild_stripe_config')
      .select('stripe_secret_key, enabled')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (configError || !stripeConfig?.stripe_secret_key || !stripeConfig.enabled) {
      return NextResponse.json({ error: 'Payments are not set up for this server.' }, { status: 400 });
    }

    const { data: subRow } = await supabaseAdmin
      .from('guild_shop_subscriptions')
      .select('stripe_subscription_id')
      .eq('guild_id', guildId)
      .eq('discord_user_id', discordId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    const stripeSubId = (subRow as { stripe_subscription_id?: string } | null)?.stripe_subscription_id;
    if (!stripeSubId) {
      return NextResponse.json({
        error: 'You have no active subscription. The portal is for managing an existing subscription.',
      }, { status: 400 });
    }

    const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${stripeSubId}`, {
      headers: { Authorization: `Bearer ${stripeConfig.stripe_secret_key}` },
    });
    const subData = await subRes.json().catch(() => ({}));
    const customerId = subData.customer;
    if (!customerId) {
      return NextResponse.json({ error: 'Could not find subscription customer.' }, { status: 400 });
    }

    const params = new URLSearchParams();
    params.append('customer', customerId);
    params.append('return_url', returnUrl || defaultReturn);

    const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeConfig.stripe_secret_key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-12-18.acacia',
      },
      body: params.toString(),
    });

    const data = await portalRes.json();
    if (!portalRes.ok) {
      return NextResponse.json({ error: data.error?.message || 'Failed to create portal session' }, { status: 500 });
    }
    if (!data.url) {
      return NextResponse.json({ error: 'No portal URL returned.' }, { status: 500 });
    }
    return NextResponse.json({ url: data.url });
  } catch (e) {
    console.error('Shop portal error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

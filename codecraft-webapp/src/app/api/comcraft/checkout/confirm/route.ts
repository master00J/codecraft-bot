import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requirePaymentProviderConfig } from '@/lib/payments/providers';
import { markOrderPaid, markPaymentStatus } from '@/lib/payments/state';
import { createLicenseForUser, assignLicenseToGuild } from '@/lib/comcraft/licenses';
import type { ComcraftTierId } from '@/lib/comcraft/tiers';

async function getPayPalToken(clientId: string, clientSecret: string, baseApiUrl: string) {
  const response = await fetch(`${baseApiUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate with PayPal');
  }

  return response.json() as Promise<{ access_token: string }>;
}

async function provisionLicense(options: {
  order: {
    id: string;
    user_id: string | null;
    discord_guild_id: string | null;
    service_name: string | null;
    additional_info?: string | null;
  };
  paymentId: string;
}) {
  const { order, paymentId } = options;

  if (!order.user_id) {
    console.error('Cannot provision license, order has no user_id', order.id);
    return;
  }

  const tier = (order.service_name?.toLowerCase() || 'premium') as ComcraftTierId;

  // Parse additional_info to get expiresAt and maxGuilds
  let expiresAt: string | null = null;
  let maxGuilds: number | undefined = undefined;
  if (order.additional_info) {
    try {
      const additionalInfo = JSON.parse(order.additional_info);
      expiresAt = additionalInfo.expiresAt || null;
      maxGuilds = additionalInfo.maxGuilds ? Number(additionalInfo.maxGuilds) : undefined;
    } catch (e) {
      console.warn('Failed to parse additional_info for order', order.id, e);
    }
  }

  try {
    const license = await createLicenseForUser({
      userId: order.user_id,
      tier,
      paymentId,
      expiresAt,
      maxGuilds,
    });

    if (order.discord_guild_id) {
      await assignLicenseToGuild(license.id, order.discord_guild_id);
    }
  } catch (error) {
    console.error('Failed to provision license for order', order.id, error);
    throw error;
  }
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, paymentId, orderId, payload } = body as {
      provider?: string;
      paymentId?: string;
      orderId?: string;
      payload?: Record<string, any>;
    };

    if (!provider || !paymentId || !orderId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const providerConfig = await requirePaymentProviderConfig(provider);

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (payment.order_id !== orderId) {
      return NextResponse.json({ error: 'Payment does not belong to order' }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, discord_guild_id, service_name, payment_status, additional_info')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ success: true, message: 'Order already paid' });
    }

    switch (provider) {
      case 'paypal': {
        const clientId = providerConfig.config?.clientId;
        const clientSecret = providerConfig.config?.clientSecret;
        const environment = providerConfig.config?.environment === 'live' ? 'live' : 'sandbox';
        if (!clientId || !clientSecret) {
          throw new Error('PayPal credentials not configured');
        }
        const baseApiUrl = environment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
        const { access_token } = await getPayPalToken(clientId, clientSecret, baseApiUrl);
        const token = payload?.token || payload?.orderId;
        const payerId = payload?.PayerID || payload?.payerId;
        if (!token) {
          return NextResponse.json({ error: 'Missing PayPal token' }, { status: 400 });
        }
        const captureResponse = await fetch(`${baseApiUrl}/v2/checkout/orders/${token}/capture`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
        });
        const captureData = await captureResponse.json();
        if (!captureResponse.ok) {
          console.error('PayPal capture error:', captureData);
          return NextResponse.json({ error: 'Failed to capture PayPal order' }, { status: 400 });
        }
        if (captureData.status !== 'COMPLETED') {
          return NextResponse.json({ error: 'Payment not completed yet' }, { status: 400 });
        }
        await markPaymentStatus(paymentId, 'confirmed', {
          paypal: {
            ...(payment.metadata?.paypal || {}),
            capture: captureData,
          },
        });
        await markOrderPaid(orderId, provider);
        await provisionLicense({ order, paymentId });
        return NextResponse.json({ success: true });
      }
      case 'stripe': {
        const secretKey = providerConfig.config?.secretKey;
        if (!secretKey) {
          throw new Error('Stripe secret key not configured');
        }
        const sessionId = payload?.session_id || payment.transaction_id;
        if (!sessionId) {
          return NextResponse.json({ error: 'Missing Stripe session id' }, { status: 400 });
        }
        const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        });
        const sessionData = await response.json();
        if (!response.ok) {
          console.error('Stripe session fetch error:', sessionData);
          return NextResponse.json({ error: 'Failed to verify Stripe session' }, { status: 400 });
        }
        if (sessionData.payment_status !== 'paid') {
          return NextResponse.json({ error: 'Stripe payment not completed yet' }, { status: 400 });
        }
        await markPaymentStatus(paymentId, 'confirmed', {
          stripe: {
            ...(payment.metadata?.stripe || {}),
            session: sessionData,
          },
        });
        await markOrderPaid(orderId, provider);
        await provisionLicense({ order, paymentId });
        return NextResponse.json({ success: true });
      }
      default:
        return NextResponse.json({ error: 'Provider confirmation not supported' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error confirming Comcraft checkout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

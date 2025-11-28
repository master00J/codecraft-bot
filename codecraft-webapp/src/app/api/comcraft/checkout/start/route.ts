import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requirePaymentProviderConfig } from '@/lib/payments/providers';
import { initiatePayment } from '@/lib/payments/initiate';

export const dynamic = 'force-dynamic';

async function ensureUser(discordId: string) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('discord_id', discordId)
    .single();

  return data;
}

async function ensureGuildAccess(guildId: string, discordId: string) {
  const { data } = await supabaseAdmin
    .from('guild_authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .single();

  return data;
}

async function getTier(tierName: string) {
  const { data } = await supabaseAdmin
    .from('subscription_tiers')
    .select('*')
    .eq('tier_name', tierName)
    .eq('is_active', true)
    .single();

  return data;
}

async function createOrder(params: {
  userId: string | null;
  discordId: string;
  guildId: string | null;
  tierName: string;
  price: number;
  currency: string;
  billingPeriod?: 'monthly' | 'yearly';
  expiresAt?: Date;
  maxGuilds?: number;
}) {
  const orderNumber = `CC${Date.now().toString().slice(-6)}${Math.random()
    .toString(36)
    .slice(-3)
    .toUpperCase()}`;

  const { data, error } = await supabaseAdmin
    .from('orders')
    .insert({
      order_number: orderNumber,
      user_id: params.userId,
      discord_id: params.discordId,
      discord_guild_id: params.guildId,
      service_type: 'comcraft_subscription',
      service_name: params.tierName,
      price: params.price,
      payment_status: 'pending',
      status: 'pending',
      contact_method: 'discord',
      additional_info: JSON.stringify({
        billingPeriod: params.billingPeriod,
        expiresAt: params.expiresAt?.toISOString(),
        maxGuilds: params.maxGuilds,
      }),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function createPayment(orderId: string, amount: number, currency: string, provider: string) {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .insert({
      order_id: orderId,
      amount,
      currency,
      status: 'pending',
      provider,
      metadata: {},
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    const discordId = session.user.discordId as string | undefined;

    if (!discordId) {
      return NextResponse.json({ error: 'No Discord account linked' }, { status: 400 });
    }

    const body = await request.json();
    const { guildId, tier, provider, billingPeriod } = body as {
      guildId?: string | null;
      tier?: string;
      provider?: string;
      billingPeriod?: 'monthly' | 'yearly';
    };

    if (!tier || !provider) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const period = billingPeriod || 'monthly';

    const [user, tierConfig, providerConfig] = await Promise.all([
      ensureUser(discordId),
      getTier(tier),
      requirePaymentProviderConfig(provider),
    ]);

    if (!tierConfig) {
      return NextResponse.json({ error: 'Tier not found or inactive' }, { status: 404 });
    }

    if (guildId) {
      const guildAccess = await ensureGuildAccess(guildId, discordId);
      if (!guildAccess) {
        return NextResponse.json({ error: 'You do not have access to this guild' }, { status: 403 });
      }
    }

    const price = period === 'yearly' 
      ? Number(tierConfig.price_yearly || 0)
      : Number(tierConfig.price_monthly || 0);
    const currency = tierConfig.currency || 'USD';

    if (!price || price <= 0) {
      return NextResponse.json({ error: 'Tier pricing not configured' }, { status: 400 });
    }

    // Calculate expiry date based on billing period
    const expiryDate = new Date();
    if (period === 'yearly') {
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    } else {
      expiryDate.setMonth(expiryDate.getMonth() + 1);
    }

    // Get max_guilds from tier limits
    const maxGuilds = tierConfig.limits?.max_guilds 
      ? (typeof tierConfig.limits.max_guilds === 'number' 
          ? tierConfig.limits.max_guilds 
          : parseInt(tierConfig.limits.max_guilds, 10) || 1)
      : 1;

    const order = await createOrder({
      userId: user?.id || null,
      discordId,
      guildId: guildId || null,
      tierName: tier,
      price,
      currency,
      billingPeriod: period,
      expiresAt: expiryDate,
      maxGuilds,
    });

    const payment = await createPayment(order.id, price, currency, provider);

    const baseUrl =
      process.env.NEXTAUTH_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const initiate = await initiatePayment(providerConfig, {
      order,
      payment,
      amount: price,
      currency,
      guildId: guildId || null,
      tier,
      billingPeriod: period,
      baseUrl,
      user: {
        discordId,
        // @ts-ignore
        email: session.user.email || null,
        // @ts-ignore
        username: session.user.name || null,
      },
    });

    return NextResponse.json({
      success: true,
      order,
      payment,
      action: initiate,
    });
  } catch (error) {
    console.error('Error starting Comcraft checkout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

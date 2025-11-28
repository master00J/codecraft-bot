import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DEFAULT_PROVIDERS = [
  { provider: 'paypal', display_name: 'PayPal' },
  { provider: 'stripe', display_name: 'Stripe' },
  { provider: 'coinpayments', display_name: 'CoinPayments' },
  { provider: 'nowpayments', display_name: 'NOWPayments' },
  { provider: 'direct_wallet', display_name: 'Direct Crypto Wallets' },
];

async function ensureDefaultProviders() {
  // First, check which providers already exist
  const { data: existing } = await supabaseAdmin
    .from('payment_providers')
    .select('provider');

  const existingProviders = new Set((existing || []).map((p: any) => p.provider));

  // Only insert providers that don't exist yet
  const newProviders = DEFAULT_PROVIDERS.filter(
    (provider) => !existingProviders.has(provider.provider)
  );

  if (newProviders.length === 0) {
    return; // All providers already exist
  }

  const { error } = await supabaseAdmin.from('payment_providers').insert(
    newProviders.map((provider) => ({
      provider: provider.provider,
      display_name: provider.display_name,
      config: {},
      is_active: false,
      auto_verification: false,
    }))
  );

  if (error) {
    console.error('Failed to seed default payment providers:', error);
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ensureDefaultProviders();

    const { data, error } = await supabaseAdmin
      .from('payment_providers')
      .select('*')
      .order('display_name', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ providers: data || [], success: true });
  } catch (error) {
    console.error('Error fetching payment providers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
import { supabaseAdmin } from '@/lib/supabase/server';

export type PaymentProviderConfig = {
  provider: string;
  display_name: string;
  is_active: boolean;
  auto_verification: boolean;
  config: Record<string, any> | null;
};

export async function getPaymentProviderConfig(provider: string): Promise<PaymentProviderConfig | null> {
  const { data, error } = await supabaseAdmin
    .from('payment_providers')
    .select('*')
    .eq('provider', provider)
    .single();

  if (error || !data) {
    return null;
  }

  return data as PaymentProviderConfig;
}

export async function requirePaymentProviderConfig(provider: string): Promise<PaymentProviderConfig> {
  const config = await getPaymentProviderConfig(provider);
  if (!config || !config.is_active) {
    throw new Error(`Payment provider ${provider} is not active or configured`);
  }
  return config;
}

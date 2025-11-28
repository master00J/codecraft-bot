import { supabaseAdmin } from '@/lib/supabase/server';

export async function activateGuildSubscription(guildId: string, tier: string) {
  const updates = {
    subscription_tier: tier,
    subscription_active: true,
    subscription_updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from('guild_configs')
    .update(updates)
    .eq('guild_id', guildId);

  if (error) {
    console.error('Failed to activate guild subscription:', error);
    throw error;
  }
}

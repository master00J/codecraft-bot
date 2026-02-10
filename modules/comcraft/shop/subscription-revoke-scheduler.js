/**
 * Shop subscription revoke scheduler
 * Periodically revokes Discord roles for guild_shop_subscriptions that have passed current_period_end.
 * Run every hour; webhook handles cancellation, this handles natural expiry.
 */

const { createClient } = require('@supabase/supabase-js');

const RUN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

class ShopSubscriptionRevokeScheduler {
  constructor(client) {
    this.client = client;
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    this.interval = null;
    this.isRunning = false;
  }

  start() {
    this.runOnce().catch((err) => console.error('❌ [ShopSubs] Initial run error:', err));
    this.interval = setInterval(() => {
      this.runOnce().catch((err) => console.error('❌ [ShopSubs] Scheduled run error:', err));
    }, RUN_INTERVAL_MS);
    console.log('✅ [ShopSubs] Subscription revoke scheduler started (every 1h)');
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async runOnce() {
    if (this.isRunning || !this.client) return;
    this.isRunning = true;

    try {
      const now = new Date().toISOString();
      const { data: rows, error } = await this.supabase
        .from('guild_shop_subscriptions')
        .select('id, guild_id, shop_item_id, discord_user_id')
        .eq('status', 'active')
        .lt('current_period_end', now);

      if (error || !rows?.length) {
        this.isRunning = false;
        return;
      }

      const DiscordManager = require('../discord-manager');
      const manager = new DiscordManager(this.client);

      for (const row of rows) {
        const { data: item } = await this.supabase
          .from('guild_shop_items')
          .select('discord_role_id')
          .eq('id', row.shop_item_id)
          .maybeSingle();

        if (item?.discord_role_id) {
          const result = await manager.removeRoleFromMember(
            row.guild_id,
            row.discord_user_id,
            item.discord_role_id,
            'Shop subscription expired'
          );
          if (!result.success) {
            console.warn(`[ShopSubs] Could not remove role for ${row.discord_user_id} in ${row.guild_id}:`, result.error);
          }
        }

        await this.supabase
          .from('guild_shop_subscriptions')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', row.id);
      }

      if (rows.length > 0) {
        console.log(`✅ [ShopSubs] Revoked ${rows.length} expired subscription(s).`);
      }
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = ShopSubscriptionRevokeScheduler;

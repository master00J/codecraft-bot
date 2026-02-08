/**
 * Game Verification Manager (bot-side)
 * Handles in-game username verification: one-time per user, role swap, nickname set.
 */

const { createClient } = require('@supabase/supabase-js');

class GameVerificationManager {
  constructor() {
    this.supabase = null;
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    }
  }

  async getVerifiedUser(guildId, userId) {
    if (!this.supabase) return null;
    const { data } = await this.supabase
      .from('game_verified_users')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .maybeSingle();
    return data;
  }

  async recordVerification(guildId, userId, inGameUsername) {
    if (!this.supabase) return { success: false, error: 'Database not configured' };
    const username = String(inGameUsername).trim().slice(0, 32);
    const { data, error } = await this.supabase
      .from('game_verified_users')
      .upsert(
        {
          guild_id: guildId,
          user_id: userId,
          in_game_username: username,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'guild_id,user_id' }
      )
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async updateUsername(guildId, userId, inGameUsername) {
    if (!this.supabase) return { success: false, error: 'Database not configured' };
    const username = String(inGameUsername).trim().slice(0, 32);
    const { data, error } = await this.supabase
      .from('game_verified_users')
      .update({ in_game_username: username, updated_at: new Date().toISOString() })
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .select()
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }
}

module.exports = new GameVerificationManager();

/**
 * Activity Logger
 * Logs all important actions to Supabase and console
 */

const { createClient } = require('@supabase/supabase-js');

class ActivityLogger {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Log an activity
   * @param {Object} params - Activity details
   */
  async log({
    actionType,
    actionCategory,
    description,
    actorType = 'user',
    actorId = null,
    actorName = null,
    targetType = null,
    targetId = null,
    targetName = null,
    guildId = null,
    metadata = {},
    status = 'success',
    errorMessage = null
  }) {
    try {
      // Console log with color coding
      const emoji = this.getEmojiForCategory(actionCategory);
      const statusSymbol = status === 'success' ? '✅' : status === 'failed' ? '❌' : '⏳';
      
      console.log(`${emoji} ${statusSymbol} [${actionCategory.toUpperCase()}] ${description}`);
      if (metadata && Object.keys(metadata).length > 0) {
        console.log('   📝 Details:', JSON.stringify(metadata, null, 2));
      }

      // Database log
      const { data, error } = await this.supabase
        .from('activity_logs')
        .insert({
          action_type: actionType,
          action_category: actionCategory,
          description,
          actor_type: actorType,
          actor_id: actorId,
          actor_name: actorName,
          target_type: targetType,
          target_id: targetId,
          target_name: targetName,
          guild_id: guildId,
          metadata: metadata || {},
          status,
          error_message: errorMessage
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to log activity to database:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('❌ Error in activity logger:', err);
      return null;
    }
  }

  /**
   * Quick log methods for common actions
   */

  // Stream actions
  async logStreamAdded(guildId, streamerName, platform, addedBy, metadata = {}) {
    return this.log({
      actionType: 'stream.added',
      actionCategory: 'stream',
      description: `Stream notification added for ${streamerName} (${platform})`,
      actorId: addedBy.id,
      actorName: addedBy.name,
      targetType: 'stream',
      targetName: streamerName,
      guildId,
      metadata: { platform, ...metadata }
    });
  }

  async logStreamRemoved(guildId, streamerName, platform, removedBy) {
    return this.log({
      actionType: 'stream.removed',
      actionCategory: 'stream',
      description: `Stream notification removed for ${streamerName} (${platform})`,
      actorId: removedBy.id,
      actorName: removedBy.name,
      targetType: 'stream',
      targetName: streamerName,
      guildId
    });
  }

  async logStreamNotificationSent(guildId, streamerName, platform, viewers) {
    return this.log({
      actionType: 'stream.notification_sent',
      actionCategory: 'stream',
      description: `Sent live notification for ${streamerName}`,
      actorType: 'bot',
      targetType: 'stream',
      targetName: streamerName,
      guildId,
      metadata: { platform, viewers }
    });
  }

  // Config actions
  async logConfigUpdated(guildId, configType, updatedBy, changes = {}) {
    return this.log({
      actionType: 'config.updated',
      actionCategory: 'config',
      description: `Updated ${configType} configuration`,
      actorId: updatedBy.id,
      actorName: updatedBy.name,
      targetType: 'guild',
      targetId: guildId,
      guildId,
      metadata: changes
    });
  }

  async logBotPersonalizationUpdated(guildId, updatedBy, changes = {}) {
    return this.log({
      actionType: 'config.bot_personalization',
      actionCategory: 'config',
      description: `Updated bot personalization settings`,
      actorId: updatedBy.id,
      actorName: updatedBy.name,
      targetType: 'guild',
      targetId: guildId,
      guildId,
      metadata: changes
    });
  }

  // Moderation actions
  async logModerationAction(guildId, action, targetUser, moderator, reason = null) {
    return this.log({
      actionType: `moderation.${action}`,
      actionCategory: 'moderation',
      description: `${moderator.name} ${action}ed ${targetUser.name}${reason ? `: ${reason}` : ''}`,
      actorId: moderator.id,
      actorName: moderator.name,
      targetType: 'user',
      targetId: targetUser.id,
      targetName: targetUser.name,
      guildId,
      metadata: { action, reason }
    });
  }

  // Bot deployment (CodeCraft)
  async logBotDeployment(orderId, serverUuid, deployedBy, tierConfig) {
    return this.log({
      actionType: 'bot.deployed',
      actionCategory: 'admin',
      description: `Discord bot deployed for order ${orderId}`,
      actorId: deployedBy?.id || 'system',
      actorName: deployedBy?.name || 'Auto-Provision System',
      actorType: deployedBy ? 'admin' : 'system',
      targetType: 'order',
      targetId: orderId,
      metadata: { serverUuid, tierConfig }
    });
  }

  // Payment actions (CodeCraft)
  async logPaymentVerified(orderId, paymentId, verifiedBy, amount) {
    return this.log({
      actionType: 'payment.verified',
      actionCategory: 'billing',
      description: `Payment verified for order ${orderId}`,
      actorId: verifiedBy.id,
      actorName: verifiedBy.name,
      targetType: 'order',
      targetId: orderId,
      metadata: { paymentId, amount }
    });
  }

  // User actions
  async logUserJoined(guildId, user) {
    return this.log({
      actionType: 'user.joined',
      actionCategory: 'user',
      description: `${user.name} joined the server`,
      actorType: 'system',
      targetType: 'user',
      targetId: user.id,
      targetName: user.name,
      guildId
    });
  }

  async logUserLeft(guildId, user) {
    return this.log({
      actionType: 'user.left',
      actionCategory: 'user',
      description: `${user.name} left the server`,
      actorType: 'system',
      targetType: 'user',
      targetId: user.id,
      targetName: user.name,
      guildId
    });
  }

  // Error logging
  async logError(error, context = {}) {
    return this.log({
      actionType: 'system.error',
      actionCategory: 'system',
      description: `Error: ${error.message || 'Unknown error'}`,
      actorType: 'system',
      status: 'failed',
      errorMessage: error.stack || error.message,
      metadata: context
    });
  }

  /**
   * Get emoji for action category
   */
  getEmojiForCategory(category) {
    const emojiMap = {
      stream: '🎮',
      config: '⚙️',
      moderation: '🛡️',
      admin: '👑',
      billing: '💰',
      user: '👤',
      system: '🤖'
    };
    return emojiMap[category] || '📝';
  }

  /**
   * Get recent logs for a guild
   */
  async getGuildLogs(guildId, limit = 50) {
    const { data, error } = await this.supabase
      .from('activity_logs')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching guild logs:', error);
      return [];
    }

    return data;
  }

  /**
   * Get all recent logs (admin only)
   */
  async getAllLogs(limit = 100) {
    const { data, error } = await this.supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching all logs:', error);
      return [];
    }

    return data;
  }
}

// Singleton instance
const activityLogger = new ActivityLogger();

module.exports = activityLogger;


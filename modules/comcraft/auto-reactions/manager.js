/**
 * Auto-Reactions Manager
 * Handles automatic emoji reactions based on trigger words in messages
 */

const { createClient } = require('@supabase/supabase-js');

class AutoReactionsManager {
  constructor() {
    const hasUrl = !!process.env.SUPABASE_URL;
    const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log(`🔧 [AutoReactions] Initializing manager...`);
    console.log(`   SUPABASE_URL: ${hasUrl ? 'set (' + process.env.SUPABASE_URL.substring(0, 20) + '...)' : 'NOT SET'}`);
    console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${hasKey ? 'set' : 'NOT SET'}`);
    
    if (!hasUrl || !hasKey) {
      console.warn('⚠️ [AutoReactions] Supabase not configured - auto-reactions will be disabled');
      this.supabase = null;
    } else {
      try {
        this.supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        console.log('✅ [AutoReactions] Supabase client created successfully');
      } catch (error) {
        console.error('❌ [AutoReactions] Error creating Supabase client:', error);
        this.supabase = null;
      }
    }

    // Cache for auto-reactions rules per guild
    this.reactionsCache = new Map(); // Map<guildId, reactions[]>
    this.configCache = new Map(); // Map<guildId, config>
    this.cooldowns = new Map(); // Map<guildId:channelId:triggerWord, timestamp>
  }

  /**
   * Get auto-reactions configuration for a guild
   */
  async getConfig(guildId) {
    if (!this.supabase) {
      console.log(`⚠️ [AutoReactions] Cannot get config: Supabase not configured`);
      return null;
    }

    // Check cache first
    if (this.configCache.has(guildId)) {
      const cached = this.configCache.get(guildId);
      console.log(`📦 [AutoReactions] Using cached config for guild ${guildId}`);
      return cached;
    }

    try {
      console.log(`🔍 [AutoReactions] Fetching config for guild ${guildId} from database`);
      const { data, error } = await this.supabase
        .from('auto_reactions_configs')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error(`❌ [AutoReactions] Error fetching config for guild ${guildId}:`, error);
        return null;
      }

      // Default config if not found
      const config = data || {
        guild_id: guildId,
        enabled: true,
        allowed_channels: [],
        ignored_channels: [],
        use_word_boundaries: true,
        case_sensitive: false,
      };

      if (!data) {
        console.log(`ℹ️  [AutoReactions] No config found for guild ${guildId}, using defaults`);
      } else {
        console.log(`✅ [AutoReactions] Config loaded for guild ${guildId}:`, {
          enabled: config.enabled,
          allowed_channels: config.allowed_channels?.length || 0,
          ignored_channels: config.ignored_channels?.length || 0,
          use_word_boundaries: config.use_word_boundaries,
          case_sensitive: config.case_sensitive,
        });
      }

      // Cache config
      this.configCache.set(guildId, config);

      return config;
    } catch (error) {
      console.error(`❌ [AutoReactions] Error in getConfig for guild ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Get all auto-reactions rules for a guild
   */
  async getReactions(guildId) {
    if (!this.supabase) {
      console.log(`⚠️ [AutoReactions] Cannot get reactions: Supabase not configured`);
      return [];
    }

    // Check cache first
    if (this.reactionsCache.has(guildId)) {
      const cached = this.reactionsCache.get(guildId);
      console.log(`📦 [AutoReactions] Using cached reactions for guild ${guildId} (${cached.length} rule(s))`);
      return cached;
    }

    try {
      console.log(`🔍 [AutoReactions] Fetching reactions for guild ${guildId} from database`);
      const { data, error } = await this.supabase
        .from('auto_reactions')
        .select('*')
        .eq('guild_id', guildId)
        .eq('enabled', true)
        .order('created_at', { ascending: true });

      if (error) {
        console.error(`❌ [AutoReactions] Error fetching reactions for guild ${guildId}:`, error);
        return [];
      }

      const reactions = data || [];

      console.log(`✅ [AutoReactions] Loaded ${reactions.length} enabled reaction rule(s) for guild ${guildId}`);
      if (reactions.length > 0) {
        reactions.forEach((r, idx) => {
          console.log(`   [${idx + 1}] Rule #${r.id}: triggers=[${r.trigger_words?.join(', ') || 'none'}], emojis=[${r.emoji_ids?.join(', ') || 'none'}]`);
        });
      }

      // Cache reactions
      this.reactionsCache.set(guildId, reactions);

      return reactions;
    } catch (error) {
      console.error(`❌ [AutoReactions] Error in getReactions for guild ${guildId}:`, error);
      return [];
    }
  }

  /**
   * Check if a message should trigger auto-reactions
   */
  async checkMessage(message) {
    try {
      const guildId = message.guild?.id;
      const channelId = message.channel?.id;
      const authorId = message.author?.id;
      const authorTag = message.author?.tag || 'unknown';
      const guildName = message.guild?.name || 'DM';
      const content = message.content?.substring(0, 100) || ''; // First 100 chars for logging

      console.log(`🔍 [AutoReactions] Checking message from ${authorTag} in ${guildName} (${guildId}/${channelId}): "${content}..."`);

      if (!message.guild) {
        console.log(`   ⏭️  Skipping: Not in a guild (DM)`);
        return;
      }

      if (message.author.bot) {
        console.log(`   ⏭️  Skipping: Message from bot`);
        return;
      }

    // Get config
    const config = await this.getConfig(guildId);
    if (!config) {
      console.log(`   ⏭️  Skipping: No config found for guild ${guildId}`);
      return;
    }

    if (!config.enabled) {
      console.log(`   ⏭️  Skipping: Auto-reactions disabled for guild ${guildId}`);
      return;
    }

    console.log(`   ✅ Config loaded: enabled=${config.enabled}, word_boundaries=${config.use_word_boundaries}, case_sensitive=${config.case_sensitive}`);

    // Check channel restrictions
    if (config.allowed_channels && config.allowed_channels.length > 0) {
      if (!config.allowed_channels.includes(channelId)) {
        console.log(`   ⏭️  Skipping: Channel ${channelId} not in allowed_channels: [${config.allowed_channels.join(', ')}]`);
        return; // Not in allowed channels
      }
      console.log(`   ✅ Channel ${channelId} is in allowed_channels`);
    }

    if (config.ignored_channels && config.ignored_channels.includes(channelId)) {
      console.log(`   ⏭️  Skipping: Channel ${channelId} is in ignored_channels: [${config.ignored_channels.join(', ')}]`);
      return; // Channel is ignored
    }

    // Get reactions
    const reactions = await this.getReactions(guildId);
    if (reactions.length === 0) {
      console.log(`   ⏭️  Skipping: No reaction rules found for guild ${guildId}`);
      return;
    }

    console.log(`   ✅ Found ${reactions.length} reaction rule(s) for guild ${guildId}`);

    // Normalize message content
    const messageContent = config.case_sensitive
      ? message.content
      : message.content.toLowerCase();

    console.log(`   📝 Message content (normalized): "${messageContent.substring(0, 100)}..."`);

    // Check each reaction rule
    for (const reaction of reactions) {
      console.log(`   🔎 Checking reaction rule #${reaction.id}:`);
      console.log(`      - Trigger words: [${(reaction.trigger_words || []).join(', ')}]`);
      console.log(`      - Emoji IDs: [${(reaction.emoji_ids || []).join(', ')}]`);
      console.log(`      - Enabled: ${reaction.enabled}`);
      console.log(`      - Cooldown: ${reaction.cooldown_seconds}s`);

      // Check if reaction is enabled
      if (!reaction.enabled) {
        console.log(`      ⏭️  Skipping: Reaction rule disabled`);
        continue;
      }

      // Check channel restrictions for this specific reaction
      if (reaction.allowed_channels && reaction.allowed_channels.length > 0) {
        if (!reaction.allowed_channels.includes(channelId)) {
          console.log(`      ⏭️  Skipping: Channel ${channelId} not in reaction's allowed_channels: [${reaction.allowed_channels.join(', ')}]`);
          continue; // Not in allowed channels for this reaction
        }
        console.log(`      ✅ Channel is in reaction's allowed_channels`);
      }

      if (reaction.ignored_channels && reaction.ignored_channels.includes(channelId)) {
        console.log(`      ⏭️  Skipping: Channel ${channelId} is in reaction's ignored_channels: [${reaction.ignored_channels.join(', ')}]`);
        continue; // Channel is ignored for this reaction
      }

      // Check cooldown
      if (reaction.cooldown_seconds > 0) {
        const cooldownKey = `${guildId}:${channelId}:${reaction.id}`;
        const lastTriggered = this.cooldowns.get(cooldownKey);
        if (lastTriggered) {
          const timeSinceLastTrigger = Date.now() - lastTriggered;
          const remainingCooldown = reaction.cooldown_seconds * 1000 - timeSinceLastTrigger;
          if (remainingCooldown > 0) {
            console.log(`      ⏭️  Skipping: Still in cooldown (${Math.ceil(remainingCooldown / 1000)}s remaining)`);
            continue; // Still in cooldown
          }
          console.log(`      ✅ Cooldown expired`);
        }
      }

      // Check if any trigger word matches
      // Ensure trigger_words is an array (handle both array and string formats)
      let triggerWords = reaction.trigger_words || [];
      if (typeof triggerWords === 'string') {
        // If it's a string, try to parse it (could be comma-separated or JSON)
        try {
          triggerWords = JSON.parse(triggerWords);
        } catch (e) {
          // If JSON parse fails, treat as comma-separated string
          triggerWords = triggerWords.split(',').map(w => w.trim()).filter(w => w.length > 0);
        }
      }
      
      // Ensure it's an array
      if (!Array.isArray(triggerWords)) {
        console.warn(`      ⚠️  trigger_words is not an array for reaction #${reaction.id}, type: ${typeof triggerWords}, value:`, triggerWords);
        triggerWords = [];
      }

      console.log(`      📋 Trigger words (raw):`, reaction.trigger_words);
      console.log(`      📋 Trigger words (parsed):`, triggerWords);
      console.log(`      📋 Trigger words count: ${triggerWords.length}`);

      if (triggerWords.length === 0) {
        console.log(`      ⏭️  Skipping: No trigger words configured`);
        continue;
      }

      const useWordBoundaries = reaction.use_word_boundaries !== undefined
        ? reaction.use_word_boundaries
        : config.use_word_boundaries;
      const caseSensitive = reaction.case_sensitive !== undefined
        ? reaction.case_sensitive
        : config.case_sensitive;

      console.log(`      🔤 Matching settings: word_boundaries=${useWordBoundaries}, case_sensitive=${caseSensitive}`);
      console.log(`      📝 Message content for matching: "${messageContent}"`);
      console.log(`      📏 Message length: ${messageContent.length} characters`);

      let matched = false;
      let matchedTrigger = null;
      for (let i = 0; i < triggerWords.length; i++) {
        const trigger = triggerWords[i];
        
        // Ensure trigger is a string
        if (typeof trigger !== 'string') {
          console.warn(`         ⚠️  Trigger at index ${i} is not a string:`, trigger, `(type: ${typeof trigger})`);
          continue;
        }

        const normalizedTrigger = caseSensitive ? trigger.trim() : trigger.trim().toLowerCase();
        const originalMessageForMatch = caseSensitive ? message.content : message.content.toLowerCase();
        
        console.log(`         [${i + 1}/${triggerWords.length}] Testing trigger: "${trigger}" (normalized: "${normalizedTrigger}")`);
        console.log(`            Original message: "${message.content}"`);
        console.log(`            Normalized message: "${originalMessageForMatch}"`);

        if (useWordBoundaries) {
          // Match whole words only - create regex that matches the word as a whole word
          const escapedTrigger = this.escapeRegex(normalizedTrigger);
          // Don't use 'g' flag with test() as it's stateful - use 'i' flag for case-insensitive instead
          const wordBoundaryRegex = new RegExp(`\\b${escapedTrigger}\\b`, caseSensitive ? '' : 'i');
          const testResult = wordBoundaryRegex.test(originalMessageForMatch);
          console.log(`            Regex: /\\b${escapedTrigger}\\b/${caseSensitive ? '' : 'i'}`);
          console.log(`            Test result: ${testResult}`);
          
          // Additional debug: show what characters are around potential matches
          const triggerIndex = originalMessageForMatch.indexOf(normalizedTrigger);
          if (triggerIndex !== -1) {
            const start = Math.max(0, triggerIndex - 5);
            const end = Math.min(originalMessageForMatch.length, triggerIndex + normalizedTrigger.length + 5);
            const context = originalMessageForMatch.substring(start, end);
            console.log(`            Context around "${normalizedTrigger}": "...${context}..." (index: ${triggerIndex})`);
            // Check word boundaries manually
            const charBefore = triggerIndex > 0 ? originalMessageForMatch[triggerIndex - 1] : 'START';
            const charAfter = triggerIndex + normalizedTrigger.length < originalMessageForMatch.length 
              ? originalMessageForMatch[triggerIndex + normalizedTrigger.length] 
              : 'END';
            const isWordCharBefore = /[a-z0-9_]/.test(charBefore);
            const isWordCharAfter = /[a-z0-9_]/.test(charAfter);
            console.log(`            Word boundary check: charBefore="${charBefore}" (word char: ${isWordCharBefore}), charAfter="${charAfter}" (word char: ${isWordCharAfter})`);
            if (isWordCharBefore || isWordCharAfter) {
              console.log(`            ⚠️  Word is part of larger word, not matching as whole word`);
            }
          }
          
          if (testResult) {
            matched = true;
            matchedTrigger = trigger;
            console.log(`         ✅✅✅ MATCH! Word boundary match for "${trigger}"`);
            break;
          } else {
            // Additional debug: check if word exists without boundaries
            const containsWithoutBoundaries = originalMessageForMatch.includes(normalizedTrigger);
            console.log(`            ❌ No match (word boundary)`);
            if (containsWithoutBoundaries) {
              console.log(`            ℹ️  Note: Word exists in message but not as whole word (word boundaries enabled)`);
            } else {
              console.log(`            ℹ️  Note: Word not found in message at all`);
            }
          }
        } else {
          // Match anywhere in message
          const contains = originalMessageForMatch.includes(normalizedTrigger);
          console.log(`            Contains check: ${contains}`);
          
          if (contains) {
            matched = true;
            matchedTrigger = trigger;
            console.log(`         ✅✅✅ MATCH! Contains "${trigger}"`);
            break;
          } else {
            console.log(`            ❌ No match (substring)`);
          }
        }
      }

      if (matched) {
        console.log(`   🎯 TRIGGERED! Reaction rule #${reaction.id} matched with trigger "${matchedTrigger}"`);
        console.log(`      Reacting with emoji(s): [${reaction.emoji_ids.join(', ')}]`);

        // React with emoji(s)
        await this.reactWithEmojis(message, reaction.emoji_ids, guildId, reaction.id);

        // Update cooldown
        if (reaction.cooldown_seconds > 0) {
          const cooldownKey = `${guildId}:${channelId}:${reaction.id}`;
          this.cooldowns.set(cooldownKey, Date.now());
          console.log(`      ⏱️  Cooldown set for ${reaction.cooldown_seconds}s`);
        }

        // Update trigger count (async, don't wait)
        this.updateTriggerCount(reaction.id).catch(error => {
          console.error(`      ❌ Error updating trigger count for reaction #${reaction.id}:`, error);
        });
      } else {
        console.log(`      ❌ No trigger words matched for reaction rule #${reaction.id}`);
      }
    }

    console.log(`   ✅ Finished checking auto-reactions for message`);
    } catch (error) {
      console.error(`❌ [AutoReactions] Error in checkMessage for guild ${message.guild?.id}:`, error.message);
      console.error(`Error details:`, error);
      if (error.stack) {
        console.error(`Error stack:`, error.stack);
      }
    }
  }

  /**
   * React to a message with emoji(s)
   */
  async reactWithEmojis(message, emojiIds, guildId, reactionId = null) {
    if (!emojiIds || emojiIds.length === 0) {
      console.log(`      ⚠️  No emoji IDs provided for reaction ${reactionId || 'unknown'}`);
      return;
    }

    try {
      const guild = message.guild;
      if (!guild) {
        console.log(`      ❌ Cannot react: Message not in a guild`);
        return;
      }

      console.log(`      🎨 Reacting with ${emojiIds.length} emoji(s):`);

      // React with each emoji
      for (let i = 0; i < emojiIds.length; i++) {
        const emojiId = emojiIds[i];
        try {
          console.log(`         [${i + 1}/${emojiIds.length}] Processing emoji: "${emojiId}"`);

          // Check if it's a custom emoji (format: <:name:id> or just id)
          if (emojiId.match(/^\d+$/)) {
            // It's a custom emoji ID
            console.log(`            Type: Custom emoji ID`);
            const emoji = guild.emojis.cache.get(emojiId);
            if (emoji) {
              await message.react(emoji);
              console.log(`            ✅ Successfully reacted with custom emoji: ${emoji.name} (${emoji.id})`);
            } else {
              console.warn(`            ⚠️  Custom emoji ${emojiId} not found in guild ${guildId}`);
              console.warn(`            Available emojis: [${Array.from(guild.emojis.cache.keys()).slice(0, 5).join(', ')}...]`);
            }
          } else if (emojiId.match(/^<a?:[\w]+:\d+>$/)) {
            // It's a custom emoji format <:name:id> or <a:name:id>
            console.log(`            Type: Custom emoji format`);
            await message.react(emojiId);
            console.log(`            ✅ Successfully reacted with emoji format: ${emojiId}`);
          } else if (emojiId.match(/^<:[\w]+:>$/)) {
            // It's an incomplete custom emoji format <:name:> - try to find by name
            console.log(`            Type: Incomplete custom emoji format (missing ID)`);
            const emojiName = emojiId.match(/^<:([\w]+):>$/)[1];
            console.log(`            Looking up emoji by name: "${emojiName}"`);
            const emoji = guild.emojis.cache.find(e => e.name === emojiName);
            if (emoji) {
              await message.react(emoji);
              console.log(`            ✅ Successfully reacted with custom emoji: ${emoji.name} (${emoji.id})`);
            } else {
              console.warn(`            ⚠️  Custom emoji "${emojiName}" not found in guild ${guildId}`);
              console.warn(`            Available emoji names: [${Array.from(guild.emojis.cache.values()).slice(0, 5).map(e => e.name).join(', ')}...]`);
            }
          } else {
            // It's a Unicode emoji or emoji name
            console.log(`            Type: Unicode emoji or name`);
            // Try to find as custom emoji by name first
            const customEmoji = guild.emojis.cache.find(e => e.name === emojiId);
            if (customEmoji) {
              console.log(`            Found custom emoji by name: ${customEmoji.name} (${customEmoji.id})`);
              await message.react(customEmoji);
              console.log(`            ✅ Successfully reacted with custom emoji: ${customEmoji.name}`);
            } else {
              // Try as Unicode emoji
              await message.react(emojiId);
              console.log(`            ✅ Successfully reacted with Unicode emoji: ${emojiId}`);
            }
          }

          // Small delay between reactions to avoid rate limits
          if (i < emojiIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 250));
          }
        } catch (error) {
          console.error(`            ❌ Error reacting with emoji "${emojiId}":`, error.message);
          console.error(`            Error details:`, error);
          // Continue with next emoji
        }
      }

      console.log(`      ✅ Finished reacting with all emojis`);
    } catch (error) {
      console.error(`      ❌ Error in reactWithEmojis:`, error);
      console.error(`      Error stack:`, error.stack);
    }
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Update trigger count for a reaction
   */
  async updateTriggerCount(reactionId) {
    if (!this.supabase) {
      return;
    }

    try {
      // First get the current trigger_count
      const { data: reaction, error: fetchError } = await this.supabase
        .from('auto_reactions')
        .select('trigger_count')
        .eq('id', reactionId)
        .single();

      if (fetchError || !reaction) {
        console.error('Error fetching reaction for trigger count update:', fetchError);
        return;
      }

      // Increment and update
      const { error: updateError } = await this.supabase
        .from('auto_reactions')
        .update({
          trigger_count: (reaction.trigger_count || 0) + 1,
          last_triggered: new Date().toISOString(),
        })
        .eq('id', reactionId);

      if (updateError) {
        console.error('Error updating trigger count:', updateError);
      }
    } catch (error) {
      console.error('Error updating trigger count:', error);
    }
  }

  /**
   * Create a new auto-reaction rule
   */
  async createReaction(guildId, data) {
    if (!this.supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { data: reaction, error } = await this.supabase
        .from('auto_reactions')
        .insert({
          guild_id: guildId,
          trigger_words: data.trigger_words || [],
          emoji_ids: data.emoji_ids || [],
          enabled: data.enabled !== undefined ? data.enabled : true,
          case_sensitive: data.case_sensitive !== undefined ? data.case_sensitive : false,
          use_word_boundaries: data.use_word_boundaries !== undefined ? data.use_word_boundaries : true,
          allowed_channels: data.allowed_channels || null,
          ignored_channels: data.ignored_channels || null,
          cooldown_seconds: data.cooldown_seconds || 0,
          created_by: data.created_by || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating auto-reaction:', error);
        return { success: false, error: error.message };
      }

      // Clear cache
      this.reactionsCache.delete(guildId);

      return { success: true, reaction };
    } catch (error) {
      console.error('Error in createReaction:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an auto-reaction rule
   */
  async updateReaction(reactionId, data) {
    if (!this.supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const updates = {
        updated_at: new Date().toISOString(),
      };

      if (data.trigger_words !== undefined) updates.trigger_words = data.trigger_words;
      if (data.emoji_ids !== undefined) updates.emoji_ids = data.emoji_ids;
      if (data.enabled !== undefined) updates.enabled = data.enabled;
      if (data.case_sensitive !== undefined) updates.case_sensitive = data.case_sensitive;
      if (data.use_word_boundaries !== undefined) updates.use_word_boundaries = data.use_word_boundaries;
      if (data.allowed_channels !== undefined) updates.allowed_channels = data.allowed_channels;
      if (data.ignored_channels !== undefined) updates.ignored_channels = data.ignored_channels;
      if (data.cooldown_seconds !== undefined) updates.cooldown_seconds = data.cooldown_seconds;

      const { data: reaction, error } = await this.supabase
        .from('auto_reactions')
        .update(updates)
        .eq('id', reactionId)
        .select()
        .single();

      if (error) {
        console.error('Error updating auto-reaction:', error);
        return { success: false, error: error.message };
      }

      // Clear cache
      if (reaction) {
        this.reactionsCache.delete(reaction.guild_id);
      }

      return { success: true, reaction };
    } catch (error) {
      console.error('Error in updateReaction:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete an auto-reaction rule
   */
  async deleteReaction(reactionId) {
    if (!this.supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      // Get guild_id before deleting
      const { data: existing } = await this.supabase
        .from('auto_reactions')
        .select('guild_id')
        .eq('id', reactionId)
        .single();

      const { error } = await this.supabase
        .from('auto_reactions')
        .delete()
        .eq('id', reactionId);

      if (error) {
        console.error('Error deleting auto-reaction:', error);
        return { success: false, error: error.message };
      }

      // Clear cache
      if (existing) {
        this.reactionsCache.delete(existing.guild_id);
      }

      return { success: true };
    } catch (error) {
      console.error('Error in deleteReaction:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update auto-reactions configuration
   */
  async updateConfig(guildId, data) {
    if (!this.supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const updates = {
        updated_at: new Date().toISOString(),
      };

      if (data.enabled !== undefined) updates.enabled = data.enabled;
      if (data.allowed_channels !== undefined) updates.allowed_channels = data.allowed_channels;
      if (data.ignored_channels !== undefined) updates.ignored_channels = data.ignored_channels;
      if (data.use_word_boundaries !== undefined) updates.use_word_boundaries = data.use_word_boundaries;
      if (data.case_sensitive !== undefined) updates.case_sensitive = data.case_sensitive;

      const { data: config, error } = await this.supabase
        .from('auto_reactions_configs')
        .upsert({
          guild_id: guildId,
          ...updates,
        }, {
          onConflict: 'guild_id',
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating auto-reactions config:', error);
        return { success: false, error: error.message };
      }

      // Clear cache
      this.configCache.delete(guildId);

      return { success: true, config };
    } catch (error) {
      console.error('Error in updateConfig:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear cache for a guild
   */
  clearCache(guildId) {
    this.reactionsCache.delete(guildId);
    this.configCache.delete(guildId);
  }
}

// Singleton instance
let managerInstance = null;

/**
 * Get Auto-Reactions Manager instance
 */
function getAutoReactionsManager() {
  if (!managerInstance) {
    managerInstance = new AutoReactionsManager();
  }
  return managerInstance;
}

module.exports = getAutoReactionsManager;


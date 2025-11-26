const { createClient } = require('@supabase/supabase-js');
const embeddings = require('./embeddings');
class MemoryStore {
  constructor() {
    this.client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  async addMemory({
    guildId,
    userId = null,
    channelId = null,
    messageId = null,
    type = 'fact',
    label = null,
    summary,
    details = null,
    importance = 0,
    expiresAt = null,
  }) {
    if (!guildId || !summary) {
      return { success: false, error: 'guildId and summary are required' };
    }

    try {
      const embeddingResult = await embeddings.generateEmbedding(summary);
      const insertPayload = {
        guild_id: guildId,
        user_id: userId,
        channel_id: channelId,
        message_id: messageId,
        type,
        label,
        summary,
        details,
        importance,
        expires_at: expiresAt,
      };

      if (embeddingResult?.embedding) {
        insertPayload.embedding = embeddingResult.embedding;
        insertPayload.embedding_model = embeddingResult.model;
        insertPayload.embedding_updated_at = new Date().toISOString();
      }

      const { data, error } = await this.client
        .from('ai_memories')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return { success: true, memory: data };
    } catch (error) {
      console.error('[AI Memory] Failed to add memory:', error);
      return { success: false, error: error.message };
    }
  }

  async getRelevantMemories(guildId, options = {}) {
    if (!guildId) {
      return [];
    }

    const {
      userId = null,
      limit = 12,
      includeGlobal = true,
      minImportance = -2,
      query = null,
      similarityThreshold = 0.2,
    } = options;

    try {
      if (query) {
        const embeddingResult = await embeddings.generateEmbedding(query);
        if (embeddingResult?.embedding) {
          const { data, error } = await this.client.rpc('match_ai_memories', {
            p_guild_id: guildId,
            query_embedding: embeddingResult.embedding,
            match_count: limit,
            similarity_threshold: similarityThreshold,
            p_user_id: userId,
            include_global: includeGlobal,
            min_importance: minImportance,
          });

          if (error) {
            throw error;
          }

          if (Array.isArray(data) && data.length > 0) {
            return data;
          }
        }
      }

      const baseQuery = this.client
        .from('ai_memories')
        .select('id, summary, importance, type, updated_at, expires_at, label')
        .eq('guild_id', guildId)
        .gte('importance', minImportance)
        .order('importance', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (userId && includeGlobal) {
        baseQuery.or(`user_id.eq.${userId},user_id.is.null`);
      } else if (userId) {
        baseQuery.eq('user_id', userId);
      } else if (!includeGlobal) {
        baseQuery.is('user_id', null);
      }

      const { data, error } = await baseQuery;
      if (error) throw error;

      const now = Date.now();
      const filtered = (data || []).filter((entry) => {
        if (!entry.expires_at) return true;
        return new Date(entry.expires_at).getTime() > now;
      });

      return filtered;
    } catch (error) {
      console.error('[AI Memory] Failed to fetch memories:', error);
      return [];
    }
  }

  async summarizeMemories(memories) {
    if (!Array.isArray(memories) || memories.length === 0) {
      return '';
    }

    const lines = memories.map((entry) => {
      const label = entry.label ? `${entry.label}: ` : '';
      return `- ${label}${entry.summary}`;
    });

    return lines.join('\n');
  }

  async writeInteractionMemory({
    guildId,
    userId,
    channelId,
    messageId,
    prompt,
    response,
  }) {
    const summary = `Interaction with <@${userId}>: Q="${prompt.slice(0, 140)}" A="${response.slice(0, 180)}"`;
    return this.addMemory({
      guildId,
      userId,
      channelId,
      messageId,
      type: 'interaction',
      label: 'Conversation',
      summary,
      importance: 1,
      details: {
        prompt,
        response,
      },
    });
  }

  async listMemories(guildId, { limit = 25, offset = 0, type = null } = {}) {
    if (!guildId) return [];
    try {
      const query = this.client
        .from('ai_memories')
        .select('*')
        .eq('guild_id', guildId)
        .order('importance', { ascending: false })
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (type) {
        query.eq('type', type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[AI Memory] Failed to list memories:', error);
      return [];
    }
  }

  async deleteMemory(guildId, memoryId) {
    if (!guildId || !memoryId) {
      return { success: false, error: 'Missing guildId or memoryId' };
    }
    try {
      const { error } = await this.client
        .from('ai_memories')
        .delete()
        .eq('guild_id', guildId)
        .eq('id', memoryId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('[AI Memory] Failed to delete memory:', error);
      return { success: false, error: error.message };
    }
  }

  async pruneStaleMemories(guildId, options = {}) {
    if (!guildId) return;
    try {
      const retentionDays = options.retentionDays || 90;
      const maxEntries = options.maxEntries || 200;

      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      await this.client
        .from('ai_memories')
        .delete()
        .eq('guild_id', guildId)
        .lt('updated_at', cutoff.toISOString());

      const { data, error } = await this.client
        .from('ai_memories')
        .select('id')
        .eq('guild_id', guildId)
        .order('importance', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error || !Array.isArray(data) || data.length <= maxEntries) {
        return;
      }

      const idsToKeep = new Set(data.slice(0, maxEntries).map((entry) => entry.id));
      const idsToDelete = data.filter((entry) => !idsToKeep.has(entry.id)).map((entry) => entry.id);

      if (idsToDelete.length > 0) {
        await this.client
          .from('ai_memories')
          .delete()
          .in('id', idsToDelete);
      }
    } catch (error) {
      console.error('[AI Memory] Failed pruning memories:', error);
    }
  }
}

module.exports = new MemoryStore();


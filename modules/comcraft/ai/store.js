const { createClient } = require('@supabase/supabase-js');

class AiStore {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    this.cache = new Map();
    this.cacheTTL = 60 * 1000; // 1 minuut
  }

  getCacheKey(type, guildId) {
    return `${type}:${guildId}`;
  }

  getFromCache(key) {
    if (!this.cache.has(key)) {
      return null;
    }
    const entry = this.cache.get(key);
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  setCache(key, value) {
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clearCache(guildId) {
    // Clear all cache entries for this guild
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.includes(`:${guildId}`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  async getPersona(guildId) {
    const cacheKey = this.getCacheKey('persona', guildId);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const { data, error } = await this.supabase
      .from('ai_personas')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[AI Store] Failed to load persona:', error);
    }

    const persona = data || {
      assistant_name: 'ComCraft AI',
      system_prompt: null,
      style_guidelines: null,
    };

    this.setCache(cacheKey, persona);
    return persona;
  }

  async getSettings(guildId) {
    const cacheKey = this.getCacheKey('settings', guildId);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const { data, error } = await this.supabase
      .from('ai_settings')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[AI Store] Failed to load settings:', error);
    }

    const settings = data || {
      allow_question_command: true,
      allow_moderation: false,
      default_provider: 'gemini',
      ai_model: null,
      chat_enabled: false,
      chat_channel_id: null,
      allowed_channel_ids: [],
      chat_reply_in_thread: true,
      memory_enabled: true,
      memory_max_entries: 200,
      memory_retention_days: 90,
      web_search_enabled: false,
    };

    this.setCache(cacheKey, settings);
    return settings;
  }

  async getDocuments(guildId, limit = 5) {
    const cacheKey = this.getCacheKey(`docs:${limit}`, guildId);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const { data, error } = await this.supabase
      .from('ai_documents')
      .select('id, title, content, is_pinned, updated_at')
      .eq('guild_id', guildId)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AI Store] Failed to load documents:', error);
      return [];
    }

    this.setCache(cacheKey, data);
    return data;
  }
}

module.exports = new AiStore();


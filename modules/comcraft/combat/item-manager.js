/**
 * Combat Item Manager
 * Manages custom combat items created by server owners
 */

const { createClient } = require('@supabase/supabase-js');

class ItemManager {
  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Get all available items for a guild (for shop display)
   */
  async getAvailableItems(guildId, itemType = null) {
    try {
      let query = this.supabase
        .from('guild_combat_items')
        .select('*')
        .eq('guild_id', guildId)
        .eq('is_active', true)
        .order('rarity', { ascending: false })
        .order('price', { ascending: true });

      // Filter by item type if provided
      if (itemType) {
        query = query.eq('type', itemType);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting available items:', error);
      return [];
    }
  }

  /**
   * Get all active items for a guild (legacy method for compatibility)
   */
  async getGuildItems(guildId, filters = {}) {
    try {
      let query = this.supabase
        .from('guild_combat_items')
        .select('*')
        .eq('guild_id', guildId)
        .eq('is_active', true)
        .order('rarity', { ascending: false })
        .order('price', { ascending: true });

      // Apply filters
      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      if (filters.rarity) {
        query = query.eq('rarity', filters.rarity);
      }

      if (filters.maxPrice) {
        query = query.lte('price', filters.maxPrice);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting guild items:', error);
      return [];
    }
  }

  /**
   * Find item by name or ID
   */
  async findItem(guildId, nameOrId) {
    try {
      // Try by ID first (UUID format)
      if (nameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const { data, error } = await this.supabase
          .from('guild_combat_items')
          .select('*')
          .eq('id', nameOrId)
          .eq('guild_id', guildId)
          .single();

        if (!error && data) return data;
      }

      // Try by name (case insensitive)
      const { data, error } = await this.supabase
        .from('guild_combat_items')
        .select('*')
        .eq('guild_id', guildId)
        .ilike('name', nameOrId);

      if (error) throw error;

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error finding item:', error);
      return null;
    }
  }

  /**
   * Get a specific item by ID
   */
  async getItem(itemId) {
    try {
      const { data, error } = await this.supabase
        .from('guild_combat_items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error getting item:', error);
      return null;
    }
  }

  /**
   * Create a new custom item
   */
  async createItem(guildId, itemData, createdBy) {
    try {
      const item = {
        guild_id: guildId,
        name: itemData.name,
        description: itemData.description,
        type: itemData.item_type || itemData.type,
        icon_url: itemData.icon_url,
        damage_bonus: itemData.damage_bonus || 0,
        defense_bonus: itemData.defense_bonus || 0,
        hp_bonus: itemData.hp_bonus || 0,
        crit_chance_bonus: itemData.crit_bonus || 0,
        effect_type: itemData.effect,
        price: itemData.price || 100,
        rarity: itemData.rarity || 'common',
        required_level: itemData.level_requirement || 1,
        max_stock: itemData.max_stock,
        is_active: itemData.is_available !== undefined ? itemData.is_available : true,
      };

      const { data, error } = await this.supabase
        .from('guild_combat_items')
        .insert(item)
        .select()
        .single();

      if (error) throw error;

      return { success: true, item: data };
    } catch (error) {
      console.error('Error creating item:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an existing item
   */
  async updateItem(itemId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('guild_combat_items')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, item: data };
    } catch (error) {
      console.error('Error updating item:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete an item (soft delete by setting is_active = false)
   */
  async deleteItem(itemId) {
    try {
      const { error } = await this.supabase
        .from('guild_combat_items')
        .update({ is_active: false })
        .eq('id', itemId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error deleting item:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get default emoji for item type
   */
  getDefaultEmoji(type) {
    const emojis = {
      weapon: '⚔️',
      armor: '🛡️',
      consumable: '🧪',
    };
    return emojis[type] || '📦';
  }

  /**
   * Get rarity color for embeds
   */
  getRarityColor(rarity) {
    const colors = {
      common: '#95A5A6',
      uncommon: '#2ECC71',
      rare: '#3498DB',
      epic: '#9B59B6',
      legendary: '#F39C12',
    };
    return colors[rarity] || colors.common;
  }

  /**
   * Format item for display
   */
  formatItemDisplay(item) {
    const stats = [];
    
    if (item.damage_bonus > 0) {
      stats.push(`+${item.damage_bonus}% Damage`);
    }
    if (item.defense_bonus > 0) {
      stats.push(`+${item.defense_bonus}% Defense`);
    }
    if (item.hp_bonus > 0) {
      stats.push(`+${item.hp_bonus} HP`);
    }
    if (item.crit_chance_bonus > 0) {
      stats.push(`+${item.crit_chance_bonus}% Crit`);
    }

    // Consumable effects
    if (item.effect_type) {
      const effectMap = {
        heal: `Heals ${item.effect_value} HP`,
        buff_damage: `+${item.effect_value}% Damage`,
        buff_defense: `+${item.effect_value}% Defense`,
        restore_hp: `Restores ${item.effect_value} HP`,
      };
      stats.push(effectMap[item.effect_type] || item.effect_type);
      
      if (item.effect_duration > 0) {
        stats.push(`(${item.effect_duration} rounds)`);
      } else if (item.effect_duration === -1) {
        stats.push(`(Permanent)`);
      }
    }

    return {
      name: `${item.icon_emoji || '📦'} ${item.name}`,
      stats: stats.join(' • '),
      rarity: item.rarity,
      price: item.price,
      type: item.type,
    };
  }
}

module.exports = ItemManager;


/**
 * Combat Inventory Manager
 * Manages player inventories and equipped items
 */

const { createClient } = require('@supabase/supabase-js');

class InventoryManager {
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
   * Get user's full inventory (items, equipped, bonuses)
   */
  async getUserInventory(guildId, userId) {
    try {
      // Get inventory items
      const { data: inventoryData, error: invError } = await this.supabase
        .from('user_combat_inventory')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .gt('quantity', 0)
        .order('acquired_at', { ascending: false });

      if (invError) throw invError;

      // Get all item details separately (more reliable than JOIN)
      const items = [];
      if (inventoryData && inventoryData.length > 0) {
        const itemIds = inventoryData.map(inv => inv.item_id);
        
        const { data: itemDetails, error: itemError } = await this.supabase
          .from('guild_combat_items')
          .select('*')
          .in('id', itemIds);

        if (itemError) {
          console.error('Error fetching item details:', itemError);
        }

        // Map item details to inventory items
        for (const inv of inventoryData) {
          const item = itemDetails?.find(i => i.id === inv.item_id);
          if (item) {
            items.push({
              id: inv.id,
              quantity: inv.quantity,
              acquired_at: inv.acquired_at,
              item: item,
            });
          }
        }
      }

      // Get equipped items
      const equipped = await this.getEquippedItems(guildId, userId);

      // Calculate bonuses
      const bonuses = await this.calculateEquipmentBonuses(guildId, userId);

      return {
        items: items,
        equipped,
        bonuses,
      };
    } catch (error) {
      console.error('Error getting user inventory:', error);
      return {
        items: [],
        equipped: { weapon: null, armor: null },
        bonuses: { damage: 0, defense: 0, hp: 0, crit: 0 },
      };
    }
  }

  /**
   * Add item to inventory
   */
  async addItem(guildId, userId, itemId, quantity = 1) {
    try {
      // Check if user already has this item
      const { data: existing } = await this.supabase
        .from('user_combat_inventory')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .single();

      if (existing) {
        // Update quantity
        const { data, error } = await this.supabase
          .from('user_combat_inventory')
          .update({ quantity: existing.quantity + quantity })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return { success: true, inventory: data };
      } else {
        // Insert new
        const { data, error } = await this.supabase
          .from('user_combat_inventory')
          .insert({
            guild_id: guildId,
            user_id: userId,
            item_id: itemId,
            quantity,
          })
          .select()
          .single();

        if (error) throw error;
        return { success: true, inventory: data };
      }
    } catch (error) {
      console.error('Error adding item to inventory:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove item from inventory
   */
  async removeItem(guildId, userId, itemId, quantity = 1) {
    try {
      const { data: existing } = await this.supabase
        .from('user_combat_inventory')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .single();

      if (!existing) {
        return { success: false, error: 'Item not in inventory' };
      }

      const newQuantity = existing.quantity - quantity;

      if (newQuantity <= 0) {
        // Delete entry
        const { error } = await this.supabase
          .from('user_combat_inventory')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Update quantity
        const { error } = await this.supabase
          .from('user_combat_inventory')
          .update({ quantity: newQuantity })
          .eq('id', existing.id);

        if (error) throw error;
      }

      return { success: true, newQuantity: Math.max(0, newQuantity) };
    } catch (error) {
      console.error('Error removing item from inventory:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user has item
   */
  async hasItem(guildId, userId, itemId, quantity = 1) {
    try {
      const { data } = await this.supabase
        .from('user_combat_inventory')
        .select('quantity')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .single();

      return data && data.quantity >= quantity;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get specific item from user's inventory
   */
  async getItem(guildId, userId, itemId) {
    try {
      const { data, error } = await this.supabase
        .from('user_combat_inventory')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .single();

      if (error) {
        // Item not in inventory yet
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting item from inventory:', error);
      return null;
    }
  }

  /**
   * Get equipped items for a user
   */
  async getEquippedItems(guildId, userId) {
    try {
      const { data: equipped, error } = await this.supabase
        .from('user_equipped_items')
        .select('weapon_id, armor_id, equipped_at')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // No equipped items yet
        return { weapon: null, armor: null };
      }

      if (!equipped) {
        return { weapon: null, armor: null };
      }

      // Get weapon details if equipped
      let weapon = null;
      if (equipped.weapon_id) {
        const { data: weaponData } = await this.supabase
          .from('guild_combat_items')
          .select('*')
          .eq('id', equipped.weapon_id)
          .single();
        weapon = weaponData;
      }

      // Get armor details if equipped
      let armor = null;
      if (equipped.armor_id) {
        const { data: armorData } = await this.supabase
          .from('guild_combat_items')
          .select('*')
          .eq('id', equipped.armor_id)
          .single();
        armor = armorData;
      }

      return { weapon, armor };
    } catch (error) {
      console.error('Error getting equipped items:', error);
      return { weapon: null, armor: null };
    }
  }

  /**
   * Equip an item
   */
  async equipItem(guildId, userId, itemId, itemType) {
    try {
      // Verify user owns the item
      const hasItem = await this.hasItem(guildId, userId, itemId);
      if (!hasItem) {
        return { success: false, error: 'You don\'t own this item!' };
      }

      // Get full item details
      const { data: item } = await this.supabase
        .from('guild_combat_items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (!item) {
        return { success: false, error: 'Item not found!' };
      }

      if (item.type !== 'weapon' && item.type !== 'armor') {
        return { success: false, error: 'Only weapons and armor can be equipped!' };
      }

      // Check if user meets level requirement (would need combat level here)
      // For now, we'll skip this check and add it later when we have combatXPManager integrated

      // Upsert equipped item
      const updateData = {
        guild_id: guildId,
        user_id: userId,
        equipped_at: new Date().toISOString(),
      };

      if (item.type === 'weapon') {
        updateData.weapon_id = itemId;
      } else {
        updateData.armor_id = itemId;
      }

      const { error } = await this.supabase
        .from('user_equipped_items')
        .upsert(updateData, {
          onConflict: 'guild_id,user_id',
        });

      if (error) throw error;

      return { success: true, equipped: item };
    } catch (error) {
      console.error('Error equipping item:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unequip an item
   */
  async unequipItem(guildId, userId, slot) {
    try {
      if (slot !== 'weapon' && slot !== 'armor') {
        return { success: false, error: 'Invalid slot. Use "weapon" or "armor"' };
      }

      const updateData = {
        guild_id: guildId,
        user_id: userId,
      };

      updateData[`${slot}_id`] = null;

      const { error } = await this.supabase
        .from('user_equipped_items')
        .upsert(updateData, {
          onConflict: 'guild_id,user_id',
        });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error unequipping item:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate total bonuses from equipped items
   */
  async calculateEquipmentBonuses(guildId, userId) {
    try {
      const equipped = await this.getEquippedItems(guildId, userId);

      const bonuses = {
        damage: 0,
        defense: 0,
        hp: 0,
        crit: 0,
      };

      if (equipped.weapon) {
        bonuses.damage += parseInt(equipped.weapon.damage_bonus || 0);
        bonuses.crit += parseInt(equipped.weapon.crit_bonus || 0);
        bonuses.hp += parseInt(equipped.weapon.hp_bonus || 0);
      }

      if (equipped.armor) {
        bonuses.defense += parseInt(equipped.armor.defense_bonus || 0);
        bonuses.hp += parseInt(equipped.armor.hp_bonus || 0);
        bonuses.damage += parseInt(equipped.armor.damage_bonus || 0);
      }

      return bonuses;
    } catch (error) {
      console.error('Error calculating equipment bonuses:', error);
      return {
        damage: 0,
        defense: 0,
        hp: 0,
        crit: 0,
      };
    }
  }

  /**
   * Purchase item from shop
   * Note: This expects economyManager to be passed and handles the full transaction
   */
  async purchaseItem(guildId, userId, itemNameOrId, quantity, userInfo) {
    try {
      // Find the item
      const ItemManager = require('./item-manager');
      const itemManager = new ItemManager();
      const item = await itemManager.findItem(guildId, itemNameOrId);

      if (!item) {
        return { success: false, error: 'Item not found in shop!' };
      }

      if (!item.is_active) {
        return { success: false, error: 'This item is not available for purchase!' };
      }

      // Check stock
      if (item.max_stock !== null && item.current_stock < quantity) {
        return { success: false, error: `Not enough stock! Only ${item.current_stock} available.` };
      }

      const totalCost = item.price * quantity;

      // Check if user has enough coins
      const EconomyManager = require('../economy/manager');
      const economyManager = new EconomyManager();
      
      const userEconomy = await economyManager.getUserEconomy(guildId, userId, userInfo.username, userInfo.avatar);
      
      if (userEconomy.balance < totalCost) {
        return { success: false, error: `Not enough coins! You need ${economyManager.formatCoins(totalCost)} but only have ${economyManager.formatCoins(userEconomy.balance)}.` };
      }

      // Deduct coins
      const paymentResult = await economyManager.removeCoins(guildId, userId, totalCost, 'shop_purchase', `Purchased ${quantity}x ${item.name}`);
      
      if (!paymentResult.success) {
        return { success: false, error: 'Failed to process payment!' };
      }

      // Add to inventory
      await this.addItem(guildId, userId, item.id, quantity);

      // Get new quantity in inventory
      const inventoryItem = await this.getItem(guildId, userId, item.id);
      const newQuantity = inventoryItem ? inventoryItem.quantity : quantity;

      // Update stock if limited
      if (item.max_stock !== null) {
        await this.supabase
          .from('guild_combat_items')
          .update({ max_stock: item.max_stock - quantity })
          .eq('id', item.id);
      }

      // Log transaction
      await this.logTransaction(guildId, userId, item.id, 'purchase', quantity, totalCost);

      return { success: true, item, totalCost, newQuantity };
    } catch (error) {
      console.error('Error purchasing item:', error);
      return { success: false, error: 'Failed to purchase item!' };
    }
  }

  /**
   * Sell item from inventory
   */
  async sellItem(guildId, userId, itemNameOrId, quantity) {
    try {
      // Find the item
      const ItemManager = require('./item-manager');
      const itemManager = new ItemManager();
      const item = await itemManager.findItem(guildId, itemNameOrId);

      if (!item) {
        return { success: false, error: 'Item not found!' };
      }

      // Check if user has the item
      const inventory = await this.getItem(guildId, userId, item.id);
      
      if (!inventory || inventory.quantity < quantity) {
        return { success: false, error: `You don't have enough ${item.name} to sell! You have ${inventory?.quantity || 0}.` };
      }

      // Calculate sell value (50% of purchase price)
      const sellPrice = Math.floor(item.price * 0.5);
      const totalValue = sellPrice * quantity;

      // Add coins
      const EconomyManager = require('../economy/manager');
      const economyManager = new EconomyManager();
      
      await economyManager.addCoins(guildId, userId, totalValue, 'shop_sell', `Sold ${quantity}x ${item.name}`);

      // Remove from inventory
      await this.removeItem(guildId, userId, item.id, quantity);

      // Update stock if limited
      if (item.max_stock !== null) {
        await this.supabase
          .from('guild_combat_items')
          .update({ max_stock: item.max_stock + quantity })
          .eq('id', item.id);
      }

      // Log transaction
      await this.logTransaction(guildId, userId, item.id, 'sell', quantity, totalValue);

      return { success: true, item, totalValue };
    } catch (error) {
      console.error('Error selling item:', error);
      return { success: false, error: 'Failed to sell item!' };
    }
  }

  /**
   * Log item transaction
   */
  async logTransaction(guildId, userId, itemId, transactionType, quantity, price) {
    try {
      await this.supabase
        .from('combat_item_transactions')
        .insert({
          guild_id: guildId,
          user_id: userId,
          item_id: itemId,
          transaction_type: transactionType,
          quantity,
          price,
        });
    } catch (error) {
      console.error('Error logging transaction:', error);
      // Don't throw - transaction logging shouldn't block main operations
    }
  }
}

module.exports = InventoryManager;


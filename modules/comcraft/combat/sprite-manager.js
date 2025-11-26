/**
 * Combat Sprite Manager
 * Manages sprite animations for combat system
 */

const path = require('path');
const fs = require('fs');
const { AttachmentBuilder } = require('discord.js');

class SpriteManager {
  constructor() {
    this.spritePath = path.join(__dirname, 'sprites');
    this.currentSprites = new Map(); // duelId -> { player1: sprite, player2: sprite }
  }

  /**
   * Get sprite file path
   */
  getSpritePath(spriteName) {
    // Try GIF first, then PNG
    const gifPath = path.join(this.spritePath, `${spriteName}.gif`);
    const pngPath = path.join(this.spritePath, `${spriteName}.png`);
    
    if (fs.existsSync(gifPath)) {
      return gifPath;
    } else if (fs.existsSync(pngPath)) {
      return pngPath;
    }
    
    // Try with different naming conventions (e.g., "Take Hit" -> "Take Hit.png" or "Take_Hit.png")
    const altGifPath = path.join(this.spritePath, `${spriteName.replace(/\s+/g, '_')}.gif`);
    const altPngPath = path.join(this.spritePath, `${spriteName.replace(/\s+/g, '_')}.png`);
    
    if (fs.existsSync(altGifPath)) {
      return altGifPath;
    } else if (fs.existsSync(altPngPath)) {
      return altPngPath;
    }
    
    // Fallback to Idle if sprite doesn't exist
    const fallbackPath = path.join(this.spritePath, 'Idle.png');
    return fs.existsSync(fallbackPath) ? fallbackPath : null;
  }

  /**
   * Determine which sprite to use based on combat state
   */
  getSpriteForAction(duel, playerId, lastLog) {
    const player = duel.player1.id === playerId ? duel.player1 : duel.player2;
    const opponent = duel.player1.id === playerId ? duel.player2 : duel.player1;
    
    // Check if player is dead
    if (player.hp <= 0) {
      return 'Death';
    }
    
    // Check if player is taking damage (opponent attacked and didn't miss)
    if (lastLog) {
      const playerAttack = duel.player1.id === playerId ? lastLog.p1Attack : lastLog.p2Attack;
      const opponentAttack = duel.player1.id === playerId ? lastLog.p2Attack : lastLog.p1Attack;
      
      // If opponent hit this player, show "Take Hit"
      if (!opponentAttack.didMiss && opponentAttack.damage > 0) {
        return 'Take Hit';
      }
      
      // If this player attacked, show attack animation
      if (!playerAttack.didMiss && playerAttack.damage > 0) {
        // Alternate between Attack1 and Attack2 for variety
        const attackNumber = duel.round % 2 === 0 ? '1' : '2';
        return `Attack${attackNumber}`;
      }
    }
    
    // Default to Idle
    return 'Idle';
  }

  /**
   * Get sprite attachment for Discord
   */
  async getSpriteAttachment(spriteName, playerName) {
    const spritePath = this.getSpritePath(spriteName);
    
    if (!spritePath || !fs.existsSync(spritePath)) {
      return null;
    }
    
    try {
      // Sanitize sprite name for Discord attachment (remove spaces, special chars)
      const sanitizedName = spriteName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const extension = spritePath.endsWith('.gif') ? 'gif' : 'png';
      const attachmentName = `${playerName}_${sanitizedName}.${extension}`;
      
      const attachment = new AttachmentBuilder(spritePath, {
        name: attachmentName,
      });
      
      return attachment;
    } catch (error) {
      console.error(`Error creating sprite attachment for ${spriteName}:`, error);
      return null;
    }
  }

  /**
   * Get sprite URL (for embeds - requires hosting)
   * For now, we'll use attachments instead
   */
  getSpriteURL(spriteName) {
    // This would require hosting the sprites somewhere
    // For now, we'll use attachments
    return null;
  }

  /**
   * Update sprites for a duel based on current combat state
   */
  updateDuelSprites(duel, lastLog) {
    const player1Sprite = this.getSpriteForAction(duel, duel.player1.id, lastLog);
    const player2Sprite = this.getSpriteForAction(duel, duel.player2.id, lastLog);
    
    this.currentSprites.set(duel.duelId, {
      player1: player1Sprite,
      player2: player2Sprite,
    });
  }

  /**
   * Get current sprites for a duel
   */
  getDuelSprites(duelId) {
    return this.currentSprites.get(duelId) || {
      player1: 'Idle',
      player2: 'Idle',
    };
  }

  /**
   * Clear sprites for a duel (when duel ends)
   */
  clearDuelSprites(duelId) {
    this.currentSprites.delete(duelId);
  }

  /**
   * Get both sprite attachments for a duel
   */
  async getDuelAttachments(duel, player1User, player2User, lastLog) {
    this.updateDuelSprites(duel, lastLog);
    const sprites = this.getDuelSprites(duel.duelId);
    
    const attachments = [];
    
    // Get player 1 sprite
    const p1Attachment = await this.getSpriteAttachment(sprites.player1, player1User.username);
    if (p1Attachment) {
      attachments.push(p1Attachment);
    }
    
    // Get player 2 sprite
    const p2Attachment = await this.getSpriteAttachment(sprites.player2, player2User.username);
    if (p2Attachment) {
      attachments.push(p2Attachment);
    }
    
    return {
      attachments,
      player1Sprite: sprites.player1,
      player2Sprite: sprites.player2,
    };
  }
}

module.exports = SpriteManager;


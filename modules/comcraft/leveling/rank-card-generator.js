/**
 * Rank Card Generator
 * Generates custom rank card images matching the dashboard preview
 */

let canvas = null;
let createCanvas = null;
let loadImage = null;

// Try to load canvas, but gracefully handle if it's not available
try {
  canvas = require('canvas');
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
  console.log('[RankCard] Canvas module loaded successfully');
} catch (error) {
  console.warn('[RankCard] Canvas module not available. Rank card image generation will be disabled.');
  console.warn('[RankCard] To enable: Install canvas with: npm install canvas');
  console.warn('[RankCard] On Linux, you may also need: sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev');
}

const axios = require('axios');
const https = require('https');
const http = require('http');

class RankCardGenerator {
  constructor() {
    // Default dimensions matching dashboard preview
    this.width = 1000;
    this.height = 300;
    this.xpBarHeight = 20;
    this.xpBarPadding = 20;
    this.avatarSize = 120;
    this.avatarPadding = 40;
  }

  /**
   * Download image from URL
   */
  async downloadImage(url) {
    try {
      if (!url || typeof url !== 'string') {
        console.warn('Invalid image URL provided:', url);
        return null;
      }

      // Validate URL format
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        console.warn('Image URL must start with http:// or https://:', url);
        return null;
      }

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000, // Increased timeout for larger images
        maxContentLength: 10 * 1024 * 1024, // 10MB max
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        httpAgent: new http.Agent(),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ComCraft-Bot/1.0)'
        }
      });
      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading image from', url, ':', error.message);
      return null;
    }
  }

  /**
   * Load image from URL or buffer
   */
  async loadImageFromUrl(url) {
    try {
      if (!url) return null;
      if (!loadImage) {
        console.warn('[RankCard] Cannot load image: canvas module not available');
        return null;
      }
      
      const buffer = await this.downloadImage(url);
      if (!buffer) return null;
      
      return await loadImage(buffer);
    } catch (error) {
      console.error('Error loading image from URL:', url, error.message);
      return null;
    }
  }

  /**
   * Convert hex color to RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 91, g: 101, b: 242 }; // Default Discord blue
  }

  /**
   * Draw XP bar based on style
   */
  drawXPBar(ctx, x, y, width, height, progress, config = {}) {
    const style = config.xp_bar_style || 'gradient';
    const color = config.xp_bar_color || '#5865F2';
    const rgb = this.hexToRgb(color);

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x, y, width, height);

    // Calculate filled width
    const filledWidth = (width * progress) / 100;

    if (style === 'gradient') {
      // Create gradient
      const gradient = ctx.createLinearGradient(x, y, x + filledWidth, y);
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
      gradient.addColorStop(1, `rgba(${Math.min(255, rgb.r + 30)}, ${Math.min(255, rgb.g + 30)}, ${Math.min(255, rgb.b + 30)}, 1)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, filledWidth, height);
    } else if (style === 'solid') {
      // Solid color
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.fillRect(x, y, filledWidth, height);
    } else if (style === 'image' && config.xp_bar_image_url) {
      // For image style, we'd need to load and tile the image
      // For now, fall back to gradient
      const gradient = ctx.createLinearGradient(x, y, x + filledWidth, y);
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
      gradient.addColorStop(1, `rgba(${Math.min(255, rgb.r + 30)}, ${Math.min(255, rgb.g + 30)}, ${Math.min(255, rgb.b + 30)}, 1)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, filledWidth, height);
    }

    // Draw border
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
  }

  /**
   * Generate rank card image
   * @param {Object} options - Generation options
   * @param {Object} options.user - User object with username, avatar URL
   * @param {Object} options.rankData - Rank data (level, rank, xp, xpForNext, totalMessages)
   * @param {Object} options.config - Leveling config with customization
   * @returns {Promise<Buffer>} Image buffer
   */
  async generateRankCard({ user, rankData, config = {} }) {
    // Check if canvas is available
    if (!createCanvas || !loadImage) {
      const errorMsg = 'Canvas module is not available. Please install canvas: npm install canvas. On Linux, you may also need system dependencies (see CANVAS_INSTALLATION.md)';
      console.error(`[RankCard] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log(`[RankCard] Starting rank card generation for ${user.username}`);

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');

    // Load background image if provided
    let backgroundImage = null;
    if (config.rank_card_background_url) {
      console.log(`[RankCard] Loading background image from: ${config.rank_card_background_url}`);
      try {
        backgroundImage = await this.loadImageFromUrl(config.rank_card_background_url);
        if (backgroundImage) {
          console.log(`[RankCard] Successfully loaded background image`);
        } else {
          console.warn(`[RankCard] Failed to load background image from: ${config.rank_card_background_url}`);
        }
      } catch (error) {
        console.warn('[RankCard] Error loading background image, using default:', error.message);
      }
    } else {
      console.log('[RankCard] No background image URL provided, using default gradient');
    }

    // Draw background
    if (backgroundImage) {
      // Draw background image, scaled to cover
      ctx.drawImage(backgroundImage, 0, 0, this.width, this.height);
      
      // Add dark overlay for readability
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, this.width, this.height);
    } else {
      // Default gradient background
      const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
      gradient.addColorStop(0, '#1a1f2e');
      gradient.addColorStop(1, '#0f1419');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Draw border with custom color
    const borderColor = config.rank_card_border_color || '#5865F2';
    const borderRgb = this.hexToRgb(borderColor);
    ctx.strokeStyle = `rgb(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, this.width, this.height);

    // Load and draw avatar
    let avatarImage = null;
    try {
      // Ensure we use PNG format (not webp) since canvas doesn't support webp
      let avatarURL = user.avatarURL;
      if (avatarURL && avatarURL.includes('.webp')) {
        // Replace .webp with .png in the URL
        avatarURL = avatarURL.replace('.webp', '.png');
        console.log(`[RankCard] Converted webp avatar URL to png: ${avatarURL}`);
      }
      
      if (!avatarURL) {
        console.warn('[RankCard] No avatar URL provided');
      } else {
        avatarImage = await this.loadImageFromUrl(avatarURL);
        if (!avatarImage) {
          console.warn('[RankCard] Failed to load avatar image');
        } else {
          console.log('[RankCard] Avatar image loaded successfully');
        }
      }
    } catch (error) {
      console.error('[RankCard] Error loading avatar:', error.message);
      console.error('[RankCard] Avatar URL was:', user.avatarURL);
    }

    const avatarX = this.avatarPadding;
    const avatarY = (this.height - this.avatarSize) / 2;

    if (avatarImage) {
      // Draw avatar with circular mask
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        avatarX + this.avatarSize / 2,
        avatarY + this.avatarSize / 2,
        this.avatarSize / 2,
        0,
        Math.PI * 2
      );
      ctx.clip();
      ctx.drawImage(avatarImage, avatarX, avatarY, this.avatarSize, this.avatarSize);
      ctx.restore();

      // Draw avatar border
      ctx.strokeStyle = `rgb(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(
        avatarX + this.avatarSize / 2,
        avatarY + this.avatarSize / 2,
        this.avatarSize / 2,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    } else {
      // Fallback: draw placeholder circle
      ctx.fillStyle = '#5865F2';
      ctx.beginPath();
      ctx.arc(
        avatarX + this.avatarSize / 2,
        avatarY + this.avatarSize / 2,
        this.avatarSize / 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Calculate text positions
    const textX = avatarX + this.avatarSize + 30;
    const textStartY = this.height / 2 - 40;

    // Draw username
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px Arial';
    ctx.fillText(user.username || 'User', textX, textStartY);

    // Draw level and rank
    ctx.fillStyle = '#B9BBBE';
    ctx.font = '24px Arial';
    ctx.fillText(`Level ${rankData.level} • Rank #${rankData.rank}`, textX, textStartY + 35);

    // Calculate XP progress
    const currentLevelXP = rankData.xp % rankData.xpForNext;
    const xpProgress = Math.floor((currentLevelXP / rankData.xpForNext) * 100);

    // Determine XP bar position
    let xpBarY;
    const position = config.xp_bar_position || 'bottom';
    if (position === 'top') {
      xpBarY = this.xpBarPadding;
    } else if (position === 'center') {
      xpBarY = (this.height - this.xpBarHeight) / 2;
    } else {
      xpBarY = this.height - this.xpBarHeight - this.xpBarPadding;
    }

    const xpBarX = textX;
    const xpBarWidth = this.width - xpBarX - this.xpBarPadding;

    // Draw XP text above bar
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px Arial';
    ctx.fillText(
      `${currentLevelXP.toLocaleString()} / ${rankData.xpForNext.toLocaleString()} XP`,
      xpBarX,
      xpBarY - 10
    );

    // Draw XP bar
    this.drawXPBar(ctx, xpBarX, xpBarY, xpBarWidth, this.xpBarHeight, xpProgress, config);

    // Draw total messages (optional, bottom right)
    ctx.fillStyle = '#B9BBBE';
    ctx.font = '18px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(
      `${rankData.totalMessages.toLocaleString()} Messages`,
      this.width - this.xpBarPadding,
      this.height - this.xpBarPadding
    );
    ctx.textAlign = 'left'; // Reset

    // Return as buffer
    const buffer = canvas.toBuffer('image/png');
    console.log(`[RankCard] Rank card generated successfully, buffer size: ${buffer.length} bytes`);
    return buffer;
  }
}

module.exports = new RankCardGenerator();


/**
 * Stats Card Generator
 * Generates beautiful stats card images similar to Statbot
 */

let canvas = null;
let createCanvas = null;
let loadImage = null;

// Try to load canvas
try {
  canvas = require('canvas');
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
  console.log('[StatsCard] Canvas module loaded successfully');
} catch (error) {
  console.warn('[StatsCard] Canvas module not available. Stats card image generation will be disabled.');
}

const axios = require('axios');
const https = require('https');
const http = require('http');

class StatsCardGenerator {
  constructor() {
    // Card dimensions
    this.width = 1200;
    this.height = 700;
    this.padding = 40;
    this.cardPadding = 30;
  }

  /**
   * Download image from URL
   */
  async downloadImage(url) {
    try {
      if (!url || typeof url !== 'string') return null;
      if (!url.startsWith('http://') && !url.startsWith('https://')) return null;

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: 10 * 1024 * 1024,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        httpAgent: new http.Agent(),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ComCraft-Bot/1.0)'
        }
      });
      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading image:', error.message);
      return null;
    }
  }

  /**
   * Load image from URL
   */
  async loadImageFromUrl(url) {
    try {
      if (!url) return null;
      if (!loadImage) return null;
      
      const buffer = await this.downloadImage(url);
      if (!buffer) return null;
      
      return await loadImage(buffer);
    } catch (error) {
      console.error('Error loading image:', error.message);
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
    } : { r: 91, g: 101, b: 242 };
  }

  /**
   * Format duration in seconds to readable string
   */
  formatDuration(seconds) {
    if (!seconds || seconds < 60) return `${seconds}s`;
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Format hours to readable string
   */
  formatHours(hours) {
    if (!hours) return '0.00 hours';
    if (hours < 1) {
      const minutes = Math.floor(hours * 60);
      return `${minutes} minutes`;
    }
    return `${hours.toFixed(2)} hours`;
  }

  /**
   * Truncate text
   */
  truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    
    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  }

  /**
   * Draw chart data
   */
  drawChart(ctx, x, y, width, height, messageData, voiceData, config) {
    const chartPadding = 20;
    const chartX = x + chartPadding;
    const chartY = y + chartPadding;
    const chartWidth = width - chartPadding * 2;
    const chartHeight = height - chartPadding * 2 - 30; // Leave space for labels

    // Background
    ctx.fillStyle = config.card_theme === 'light' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(chartX, chartY, chartWidth, chartHeight);

    // Draw grid lines
    ctx.strokeStyle = config.card_theme === 'light' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const yPos = chartY + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(chartX, yPos);
      ctx.lineTo(chartX + chartWidth, yPos);
      ctx.stroke();
    }

    // Find max values for normalization
    const maxMessages = Math.max(...messageData, 1);
    const maxVoice = Math.max(...voiceData, 1);

    // Draw message line (green)
    if (messageData.length > 1) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      messageData.forEach((value, index) => {
        const xPos = chartX + (chartWidth / (messageData.length - 1)) * index;
        const yPos = chartY + chartHeight - (value / maxMessages) * chartHeight;
        
        if (index === 0) {
          ctx.moveTo(xPos, yPos);
        } else {
          ctx.lineTo(xPos, yPos);
        }
      });
      ctx.stroke();
    }

    // Draw voice line (pink/magenta)
    if (voiceData.length > 1) {
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      voiceData.forEach((value, index) => {
        const xPos = chartX + (chartWidth / (voiceData.length - 1)) * index;
        const yPos = chartY + chartHeight - (value / maxVoice) * chartHeight;
        
        if (index === 0) {
          ctx.moveTo(xPos, yPos);
        } else {
          ctx.lineTo(xPos, yPos);
        }
      });
      ctx.stroke();
    }

    // Chart title
    ctx.fillStyle = config.card_theme === 'light' ? '#FFFFFF' : '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Activity Chart', x + width / 2, y + 15);
    ctx.textAlign = 'left';

    // Legend
    const legendY = chartY + chartHeight + 20;
    ctx.font = '16px Arial';
    
    // Message legend
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(chartX, legendY - 10, 15, 3);
    ctx.fillStyle = config.card_theme === 'light' ? '#000000' : '#FFFFFF';
    ctx.fillText('Message', chartX + 20, legendY);
    
    // Voice legend
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(chartX + 120, legendY - 10, 15, 3);
    ctx.fillStyle = config.card_theme === 'light' ? '#000000' : '#FFFFFF';
    ctx.fillText('Voice', chartX + 140, legendY);
  }

  /**
   * Generate stats card
   */
  async generateStatsCard({ user, stats, config = {} }) {
    if (!createCanvas || !loadImage) {
      throw new Error('Canvas module is not available. Please install canvas: npm install canvas');
    }

    console.log(`[StatsCard] Generating stats card for ${user.username}`);

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');

    // Load background
    let backgroundImage = null;
    if (config.card_background_url) {
      backgroundImage = await this.loadImageFromUrl(config.card_background_url);
    }

    // Draw background
    if (backgroundImage) {
      ctx.drawImage(backgroundImage, 0, 0, this.width, this.height);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, this.width, this.height);
    } else {
      // Default gradient
      const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
      if (config.card_theme === 'light') {
        gradient.addColorStop(0, '#f5f5f5');
        gradient.addColorStop(1, '#e0e0e0');
      } else {
        gradient.addColorStop(0, '#1a1f2e');
        gradient.addColorStop(1, '#0f1419');
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Draw border
    const borderColor = config.card_border_color || '#5865F2';
    const borderRgb = this.hexToRgb(borderColor);
    ctx.strokeStyle = `rgb(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, this.width, this.height);

    const textColor = config.card_theme === 'light' ? '#000000' : '#FFFFFF';
    const secondaryColor = config.card_theme === 'light' ? '#666666' : '#B9BBBE';

    // Header section
    const headerY = this.padding;
    const avatarSize = 100;

    // Load and draw avatar
    let avatarImage = null;
    try {
      let avatarURL = user.avatarURL;
      if (avatarURL && avatarURL.includes('.webp')) {
        avatarURL = avatarURL.replace('.webp', '.png');
      }
      if (avatarURL) {
        avatarImage = await this.loadImageFromUrl(avatarURL);
      }
    } catch (error) {
      console.error('[StatsCard] Error loading avatar:', error.message);
    }

    const avatarX = this.padding;
    const avatarY = headerY;

    if (avatarImage) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();

      // Avatar border
      ctx.strokeStyle = `rgb(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Username and server info
    const textX = avatarX + avatarSize + 30;
    ctx.fillStyle = textColor;
    ctx.font = 'bold 32px Arial';
    ctx.fillText(user.username || 'User', textX, headerY + 35);
    
    ctx.fillStyle = secondaryColor;
    ctx.font = '20px Arial';
    const serverName = user.guildName || 'Server';
    ctx.fillText(serverName, textX, headerY + 65);

    // Dates section
    const datesY = headerY + avatarSize + 30;
    if (stats.server_joined_at) {
      const joinedDate = new Date(stats.server_joined_at).toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
      ctx.fillStyle = secondaryColor;
      ctx.font = '18px Arial';
      ctx.fillText(`Created On ${joinedDate}`, textX, datesY);
    }

    // Server ranks section
    const ranksY = datesY + 35;
    ctx.fillStyle = textColor;
    ctx.font = 'bold 24px Arial';
    ctx.fillText('Server Ranks', textX, ranksY);

    ctx.font = '20px Arial';
    if (config.show_message_rank !== false && stats.messageRank) {
      ctx.fillText(`Message #${stats.messageRank}`, textX, ranksY + 35);
    }
    if (config.show_voice_rank !== false && stats.voiceRank) {
      ctx.fillText(`Voice #${stats.voiceRank}`, textX, ranksY + 65);
    }

    // Activity stats section (right side)
    const statsRightX = this.width - this.padding - 300;
    const statsRightY = headerY;

    ctx.fillStyle = textColor;
    ctx.font = 'bold 24px Arial';
    ctx.fillText('Messages', statsRightX, statsRightY + 30);

    ctx.font = '20px Arial';
    const periods = stats.periods || {};
    const periodsConfig = {
      '1d': { label: '1d', y: 60 },
      '7d': { label: '7d', y: 90 },
      '14d': { label: '14d', y: 120 }
    };

    for (const [key, { label, y }] of Object.entries(periodsConfig)) {
      if (config[`show_${key}`] !== false && periods[key]) {
        const messages = periods[key].messages || 0;
        ctx.fillText(`${label} ${messages.toLocaleString()} messages`, statsRightX, statsRightY + y);
      }
    }

    // Voice activity section
    ctx.fillStyle = textColor;
    ctx.font = 'bold 24px Arial';
    ctx.fillText('Voice Activity', statsRightX, statsRightY + 180);

    ctx.font = '20px Arial';
    for (const [key, { label, y }] of Object.entries(periodsConfig)) {
      if (config[`show_${key}`] !== false && periods[key]) {
        const voiceHours = periods[key].voiceHours || 0;
        ctx.fillText(`${label} ${this.formatHours(voiceHours)}`, statsRightX, statsRightY + y + 150);
      }
    }

    // Top channels section (bottom left)
    if (config.show_top_channels !== false && stats.topChannels && stats.topChannels.length > 0) {
      const channelsY = ranksY + 120;
      ctx.fillStyle = textColor;
      ctx.font = 'bold 24px Arial';
      ctx.fillText('Top Channels & Applications', textX, channelsY);

      ctx.font = '18px Arial';
      stats.topChannels.slice(0, 3).forEach((channel, index) => {
        const channelName = this.truncateText(ctx, channel.channel_name || `Channel ${channel.channel_id}`, 300);
        const icon = channel.channel_type === 'voice' ? '🔊' : '#';
        const value = channel.channel_type === 'voice' 
          ? this.formatHours(channel.voice_seconds / 3600)
          : `${channel.message_count.toLocaleString()} messages`;
        
        ctx.fillText(`${icon} ${channelName}`, textX, channelsY + 35 + (index * 30));
        ctx.fillStyle = secondaryColor;
        ctx.fillText(value, textX + 200, channelsY + 35 + (index * 30));
        ctx.fillStyle = textColor;
      });
    }

    // Charts section (bottom right)
    if (config.show_charts !== false) {
      const chartWidth = 400;
      const chartHeight = 200;
      const chartX = statsRightX;
      const chartY = statsRightY + 280;

      // Generate sample chart data (you would get real data from stats)
      const days = 14;
      const messageData = Array.from({ length: days }, (_, i) => {
        // Simulated data - in real implementation, get from stats
        return Math.floor(Math.random() * 100) + 20;
      });
      
      const voiceData = Array.from({ length: days }, (_, i) => {
        // Simulated data
        return Math.random() * 10;
      });

      this.drawChart(ctx, chartX, chartY, chartWidth, chartHeight, messageData, voiceData, config);
    }

    // Footer
    ctx.fillStyle = secondaryColor;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    const lookbackDays = config.lookback_days || 14;
    const timezone = config.timezone || 'UTC';
    ctx.fillText(
      `Server Lookback: Last ${lookbackDays} days — Timezone: ${timezone}`,
      this.width / 2,
      this.height - 20
    );
    ctx.fillText('Powered by ComCraft', this.width / 2, this.height - 5);
    ctx.textAlign = 'left';

    const buffer = canvas.toBuffer('image/png');
    console.log(`[StatsCard] Stats card generated, size: ${buffer.length} bytes`);
    return buffer;
  }
}

module.exports = new StatsCardGenerator();


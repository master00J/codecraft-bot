/**
 * Professional Stats Card Generator - PRO EDITION
 * Modern Dashboard Grid Layout
 */

let canvas = null;
let createCanvas = null;
let loadImage = null;

try {
  canvas = require('canvas');
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
  console.log('[StatsCard] Canvas module loaded successfully');
} catch (error) {
  console.warn('[StatsCard] Canvas module not available.');
}

const axios = require('axios');
const https = require('https');
const http = require('http');

class StatsCardGenerator {
  constructor() {
    this.width = 1000;
    this.height = 600;
    this.padding = 32; // Iets meer ademruimte aan de randen
    this.cornerRadius = 24;
    
    // Default dark theme colors
    this.colors = this.getThemeColors('dark');
  }

  /**
   * Get color palette based on theme
   */
  getThemeColors(theme = 'dark') {
    if (theme === 'light') {
      return {
        background: '#ffffff',
        cardBg: 'rgba(248, 250, 252, 0.9)',
        cardBorder: 'rgba(15, 23, 42, 0.1)',
        textPrimary: '#0f172a',
        textSecondary: '#475569',
        textMuted: '#94a3b8',
        
        // Accents
        accentBlue: '#3b82f6',
        accentGreen: '#10b981',
        accentPurple: '#8b5cf6',
        accentOrange: '#f59e0b',
        accentRed: '#ef4444',
        
        // Gradients helpers
        glassWhite: 'rgba(0, 0, 0, 0.05)',
      };
    } else {
      // Dark theme (default)
      return {
        background: '#090c10',
        cardBg: 'rgba(22, 27, 34, 0.7)',
        cardBorder: 'rgba(240, 246, 252, 0.1)',
        textPrimary: '#f0f6fc',
        textSecondary: '#8b949e',
        textMuted: '#6e7681',
        
        // Accents
        accentBlue: '#58a6ff',
        accentGreen: '#2ea043',
        accentPurple: '#bc8cff',
        accentOrange: '#d29922',
        accentRed: '#ff7b72',
        
        // Gradients helpers
        glassWhite: 'rgba(255, 255, 255, 0.05)',
      };
    }
  }

  async downloadImage(url, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (!url || typeof url !== 'string') return null;
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 10000,
          maxContentLength: 10 * 1024 * 1024,
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        return Buffer.from(response.data);
      } catch (error) {
        if (attempt === retries) return null;
        await new Promise(r => setTimeout(r, 500));
      }
    }
    return null;
  }

  async loadImageFromUrl(url) {
    if (!url || !loadImage) return null;
    const buffer = await this.downloadImage(url);
    return buffer ? await loadImage(buffer) : null;
  }

  // --- DRAWING HELPERS ---

  roundedRect(ctx, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  drawContainer(ctx, x, y, width, height, options = {}) {
    const { bg = this.colors.cardBg, border = this.colors.cardBorder, radius = 16 } = options;
    
    // Shadow for depth
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    
    this.roundedRect(ctx, x, y, width, height, radius);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();

    // Border
    this.roundedRect(ctx, x, y, width, height, radius);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Top shine (Glass effect)
    ctx.save();
    ctx.clip();
    const grad = ctx.createLinearGradient(x, y, x, y + height);
    grad.addColorStop(0, 'rgba(255,255,255,0.03)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  }

  drawStatBox(ctx, x, y, width, height, title, value, subtext, color) {
    this.drawContainer(ctx, x, y, width, height, { 
      bg: 'rgba(22, 27, 34, 0.4)', // Slightly darker
      radius: 12
    });

    // Color accent bar top
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 2);
    ctx.lineTo(x + width - 12, y + 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    // ctx.stroke(); // Optional: Enable for top colored line

    // Icon circle background (Left)
    ctx.beginPath();
    ctx.arc(x + 30, y + height/2, 18, 0, Math.PI * 2);
    ctx.fillStyle = `${color}20`; // 20 hex = low opacity
    ctx.fill();
    
    // Dot inside
    ctx.beginPath();
    ctx.arc(x + 30, y + height/2, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Text Content
    const contentX = x + 60;
    
    // Title (Label)
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = '11px "Segoe UI", Arial';
    ctx.textAlign = 'left';
    ctx.fillText(title, contentX, y + 20);

    // Value (Big)
    ctx.fillStyle = this.colors.textPrimary;
    ctx.font = 'bold 22px "Segoe UI", Arial';
    ctx.fillText(value, contentX, y + 46);

    // Subtext (Small trend or unit)
    if (subtext) {
      ctx.fillStyle = this.colors.textMuted;
      ctx.font = '10px "Segoe UI", Arial';
      ctx.fillText(subtext, contentX, y + 60);
    }
  }

  // --- SECTIONS ---

  drawProfile(ctx, x, y, width, user, stats) {
    const avatarSize = 80;
    const centerX = x + width / 2;

    // Avatar Glow
    ctx.save();
    ctx.shadowColor = this.colors.accentBlue;
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.arc(centerX, y + avatarSize/2, avatarSize/2 - 2, 0, Math.PI*2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    // Draw Avatar Image
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, y + avatarSize/2, avatarSize/2, 0, Math.PI*2);
    ctx.clip();
    if (user.avatarImage) {
      ctx.drawImage(user.avatarImage, centerX - avatarSize/2, y, avatarSize, avatarSize);
    } else {
      ctx.fillStyle = this.colors.cardBg;
      ctx.fillRect(centerX - avatarSize/2, y, avatarSize, avatarSize);
    }
    ctx.restore();

    // Avatar Border
    ctx.beginPath();
    ctx.arc(centerX, y + avatarSize/2, avatarSize/2, 0, Math.PI*2);
    ctx.strokeStyle = this.colors.cardBorder;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Name
    ctx.fillStyle = this.colors.textPrimary;
    ctx.font = 'bold 20px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText(user.displayName || user.username, centerX, y + avatarSize + 25);

    // Join Date
    if (stats.server_joined_at) {
      const date = new Date(stats.server_joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '12px "Segoe UI", Arial';
      ctx.fillText(`Joined ${date}`, centerX, y + avatarSize + 45);
    }

    return y + avatarSize + 65; // Return end Y
  }

  drawLevelSection(ctx, x, y, width, stats) {
    if (stats.level === undefined) return y;

    const hasVoiceLevel = stats.voiceLevel !== undefined && stats.voiceLevel !== null;
    // Increase height to accommodate XP text and percentage - need space for bar + text below
    const sectionHeight = hasVoiceLevel ? 160 : 95; // Increased from 140/80 to fit XP text inside

    // Background Container
    this.drawContainer(ctx, x, y, width, sectionHeight, { bg: 'rgba(0,0,0,0.2)', radius: 12 });

    // Text Level Section
    // "Level" label
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = 'bold 10px "Segoe UI", Arial';
    ctx.textAlign = 'left';
    ctx.fillText('TEXT LEVEL', x + 16, y + 22);

    // Big Level Number
    ctx.fillStyle = this.colors.accentOrange;
    ctx.font = 'bold 32px "Segoe UI", Arial';
    ctx.textAlign = 'right';
    ctx.fillText(stats.level.toString(), x + width - 16, y + 36);

    // XP Calculations
    const xpStart = Math.pow(stats.level, 2) * 100;
    const xpCurrent = Math.max(0, stats.xp - xpStart);
    const xpNext = stats.xpForNext - xpStart;
    const progress = Math.min(100, Math.max(0, (xpCurrent / xpNext) * 100));

    // Progress Bar Background
    const barX = x + 16;
    const barY = y + 50;
    const barW = width - 32;
    const barH = 6;
    
    this.roundedRect(ctx, barX, barY, barW, barH, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();

    // Progress Fill
    if (progress > 0) {
      this.roundedRect(ctx, barX, barY, (progress/100) * barW, barH, 3);
      ctx.fillStyle = this.colors.accentOrange;
      ctx.fill();
      
      // Glow
      ctx.shadowColor = this.colors.accentOrange;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // XP Text - inside container
    ctx.fillStyle = this.colors.textMuted;
    ctx.font = '10px "Segoe UI", Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${xpCurrent.toLocaleString()} / ${xpNext.toLocaleString()} XP`, barX, barY + barH + 14);
    
    // Add percentage for text level - inside container
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.floor(progress)}%`, x + width - 16, barY + barH + 14);

    // Voice Level Section (if available)
    if (hasVoiceLevel) {
      const voiceY = y + 85; // Increased spacing from 80 to 85
      
      // "Voice Level" label
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = 'bold 10px "Segoe UI", Arial';
      ctx.textAlign = 'left';
      ctx.fillText('VOICE LEVEL', x + 16, voiceY + 22);

      // Big Voice Level Number
      ctx.fillStyle = this.colors.accentPurple;
      ctx.font = 'bold 32px "Segoe UI", Arial';
      ctx.textAlign = 'right';
      ctx.fillText(stats.voiceLevel.toString(), x + width - 16, voiceY + 36);

      // Voice XP Calculations
      const voiceXPStart = Math.pow(stats.voiceLevel, 2) * 100;
      const voiceXPCurrent = Math.max(0, stats.voiceXP - voiceXPStart);
      const voiceXPNext = stats.voiceXPForNext - voiceXPStart;
      const voiceProgress = Math.min(100, Math.max(0, (voiceXPCurrent / voiceXPNext) * 100));

      // Voice Progress Bar Background
      const voiceBarX = x + 16;
      const voiceBarY = voiceY + 50;
      const voiceBarW = width - 32;
      const voiceBarH = 6;
      
      this.roundedRect(ctx, voiceBarX, voiceBarY, voiceBarW, voiceBarH, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fill();

      // Voice Progress Fill
      if (voiceProgress > 0) {
        this.roundedRect(ctx, voiceBarX, voiceBarY, (voiceProgress/100) * voiceBarW, voiceBarH, 3);
        ctx.fillStyle = this.colors.accentPurple;
        ctx.fill();
        
        // Glow
        ctx.shadowColor = this.colors.accentPurple;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Voice XP Text - inside container
      ctx.fillStyle = this.colors.textMuted;
      ctx.font = '10px "Segoe UI", Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`${voiceXPCurrent.toLocaleString()} / ${voiceXPNext.toLocaleString()} XP`, voiceBarX, voiceBarY + voiceBarH + 14);
      
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.floor(voiceProgress)}%`, x + width - 16, voiceBarY + voiceBarH + 14);
    }

    return y + sectionHeight + 15; // Add gap at the end
  }

  drawRanksRow(ctx, x, y, width, stats, config = {}) {
    const showMessageRank = config.show_message_rank !== false && stats.messageRank;
    const showVoiceRank = config.show_voice_rank !== false && stats.voiceRank;
    
    if (!showMessageRank && !showVoiceRank) return y;

    const gap = 12;
    const boxWidth = showMessageRank && showVoiceRank ? (width - gap) / 2 : width;
    const height = 60;
    let currentX = x;

    // Message Rank
    if (showMessageRank) {
      this.drawContainer(ctx, currentX, y, boxWidth, height, { bg: this.colors.cardBg, radius: 12 });
      
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '10px "Segoe UI", Arial';
      ctx.textAlign = 'left';
      ctx.fillText('MSG RANK', currentX + 12, y + 18);

      ctx.fillStyle = this.colors.accentGreen;
      ctx.font = 'bold 24px "Segoe UI", Arial';
      ctx.fillText(`#${stats.messageRank}`, currentX + 12, y + 46);
      
      currentX += boxWidth + gap;
    }

    // Voice Rank
    if (showVoiceRank) {
      this.drawContainer(ctx, currentX, y, boxWidth, height, { bg: this.colors.cardBg, radius: 12 });
      
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '10px "Segoe UI", Arial';
      ctx.textAlign = 'left';
      ctx.fillText('VOICE RANK', currentX + 12, y + 18);

      ctx.fillStyle = this.colors.accentPurple;
      ctx.font = 'bold 24px "Segoe UI", Arial';
      ctx.fillText(`#${stats.voiceRank}`, currentX + 12, y + 46);
    }

    return y + height + 15;
  }

  drawTopChannels(ctx, x, y, width, channels) {
    if (!channels || channels.length === 0) return;

    ctx.fillStyle = this.colors.textPrimary;
    ctx.font = 'bold 12px "Segoe UI", Arial';
    ctx.textAlign = 'left';
    ctx.fillText('TOP CHANNELS', x + 4, y);

    let cy = y + 15;
    const itemH = 32;

    channels.slice(0, 4).forEach((c, i) => {
      const isVoice = c.channel_type === 'voice';
      const color = isVoice ? this.colors.accentPurple : this.colors.accentGreen;
      
      // Strip background
      if (i % 2 === 0) {
        this.roundedRect(ctx, x, cy, width, itemH, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fill();
      }

      // Icon
      ctx.fillStyle = color;
      ctx.font = 'bold 12px "Segoe UI", Arial';
      ctx.textAlign = 'center';
      ctx.fillText(isVoice ? 'V' : '#', x + 15, cy + 20);

      // Name
      ctx.fillStyle = this.colors.textPrimary;
      ctx.textAlign = 'left';
      let name = c.channel_name || 'unknown';
      if (name.length > 18) name = name.substring(0, 18) + '..';
      ctx.fillText(name, x + 30, cy + 20);

      // Value
      ctx.fillStyle = this.colors.textMuted;
      ctx.textAlign = 'right';
      ctx.font = '10px "Segoe UI", Arial';
      const val = isVoice 
        ? `${Math.round(c.voice_seconds/60)}m` 
        : `${c.message_count}`;
      ctx.fillText(val, x + width - 10, cy + 20);

      cy += itemH + 4;
    });
  }

  drawChart(ctx, x, y, width, height, mData, vData) {
    this.drawContainer(ctx, x, y, width, height, { radius: 16 });
    
    // Header inside chart area
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = 'bold 12px "Segoe UI", Arial';
    ctx.textAlign = 'left';
    ctx.fillText('ACTIVITY HISTORY (14 DAYS)', x + 20, y + 25);

    // Chart logic (Simplified reuse of your curve logic)
    const chartX = x + 20;
    const chartY = y + 40;
    const chartW = width - 40;
    const chartH = height - 60;

    // Normalize Data
    const maxM = Math.max(...(mData||[0]), 10);
    const maxV = Math.max(...(vData||[0]), 10);
    
    // Draw Message Line (Green)
    this.drawSingleLine(ctx, mData, maxM, chartX, chartY, chartW, chartH, this.colors.accentGreen);
    
    // Draw Voice Line (Purple) - Normalized to same height visually
    // To make voice visible even if low numbers, we scale it to its own max
    this.drawSingleLine(ctx, vData, maxV, chartX, chartY, chartW, chartH, this.colors.accentPurple);
  }

  drawSingleLine(ctx, data, max, x, y, w, h, color) {
    if (!data || data.length < 2) return;
    
    const points = data.map((val, i) => ({
      x: x + (w / (data.length - 1)) * i,
      y: y + h - (val / max) * h
    }));

    // Gradient Fill
    const rgb = this.hexToRgb(color);
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b}, 0.2)`);
    grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b}, 0.0)`);

    ctx.beginPath();
    ctx.moveTo(points[0].x, y + h);
    points.forEach((p, i) => {
      if(i===0) ctx.lineTo(p.x, p.y);
      else {
        const prev = points[i-1];
        const cp1x = prev.x + (p.x - prev.x) / 2;
        const cp1y = prev.y;
        const cp2x = prev.x + (p.x - prev.x) / 2;
        const cp2y = p.y;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p.x, p.y);
      }
    });
    ctx.lineTo(points[points.length-1].x, y + h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line Stroke
    ctx.beginPath();
    points.forEach((p, i) => {
      if(i===0) ctx.moveTo(p.x, p.y);
      else {
        const prev = points[i-1];
        const cp1x = prev.x + (p.x - prev.x) / 2;
        const cp1y = prev.y;
        const cp2x = prev.x + (p.x - prev.x) / 2;
        const cp2y = p.y;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p.x, p.y);
      }
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r:0, g:0, b:0 };
  }

  // --- MAIN ---

  async generateStatsCard({ user, stats, config = {} }) {
    if (!createCanvas) throw new Error('Canvas missing');
    const cvs = createCanvas(this.width, this.height);
    const ctx = cvs.getContext('2d');
    
    // Apply theme colors based on config
    const theme = config.card_theme || 'dark';
    this.colors = this.getThemeColors(theme);
    
    // Get border color from config
    const borderColor = config.card_border_color || this.colors.accentBlue;
    
    // Save context for border drawing at the end
    ctx.save();
    
    // 1. Background
    this.roundedRect(ctx, 0, 0, this.width, this.height, this.cornerRadius);
    ctx.clip();
    
    // Solid base
    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0,0, this.width, this.height);
    
    // Optional BG Image
    if (config.card_background_url) {
      const img = await this.loadImageFromUrl(config.card_background_url);
      if (img) {
        const scale = Math.max(this.width/img.width, this.height/img.height);
        ctx.globalAlpha = 0.4;
        ctx.drawImage(img, (this.width - img.width*scale)/2, (this.height - img.height*scale)/2, img.width*scale, img.height*scale);
        ctx.globalAlpha = 1.0;
      }
    } else {
      // Abstract gradient background if no image
      const grad = ctx.createRadialGradient(this.width, 0, 0, this.width, 0, 800);
      if (theme === 'light') {
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
      } else {
        grad.addColorStop(0, 'rgba(88, 166, 255, 0.15)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0,0,this.width, this.height);
    }
    
    // Draw border with custom color (after all content)
    // We'll draw this at the end, before returning

    // Avatar Loading
    let avatarImage = null;
    if (user.avatarURL) {
      avatarImage = await this.loadImageFromUrl(user.avatarURL.replace('.webp', '.png'));
    }

    // --- GRID LAYOUT SETUP ---
    const gap = 24;
    const sidebarW = 260;
    const mainW = this.width - (this.padding * 2) - sidebarW - gap;
    
    const col1X = this.padding;
    const col2X = this.padding + sidebarW + gap;
    const startY = this.padding;
    const contentHeight = this.height - (this.padding * 2);

    // === LEFT SIDEBAR ===
    // 1. Profile Card
    // We draw the profile directly on the background or in a container? 
    // Let's keep it clean, text on background, but ranks in boxes.
    let curY = startY;
    
    curY = this.drawProfile(ctx, col1X, curY, sidebarW, { ...user, avatarImage }, stats);
    
    // 2. Ranks (Message & Voice) - Compact Row (only if enabled)
    if ((config.show_message_rank !== false && stats.messageRank) || 
        (config.show_voice_rank !== false && stats.voiceRank)) {
      curY = this.drawRanksRow(ctx, col1X, curY, sidebarW, stats, config);
    }
    
    // 3. Level Bar
    curY = this.drawLevelSection(ctx, col1X, curY, sidebarW, stats);
    
    // 4. Top Channels (only if enabled)
    if (config.show_top_channels !== false) {
      this.drawTopChannels(ctx, col1X, curY, sidebarW, stats.topChannels || []);
    }


    // === RIGHT MAIN AREA ===
    // 1. Stat Cards Grid - dynamically based on enabled periods
    const periods = stats.periods || {};
    const p1 = periods['1d'] || {};
    const p7 = periods['7d'] || {};
    const p14 = periods['14d'] || {};
    const p30 = periods['30d'] || {};

    // Build list of enabled stat boxes
    const statBoxes = [];
    
    if (config.show_1d !== false && (p1.messages !== undefined || p1.voiceHours !== undefined)) {
      statBoxes.push({ type: 'messages', period: '1d', label: 'MSGS (24H)', value: (p1.messages || 0).toLocaleString(), subtitle: 'Daily activity', color: this.colors.accentGreen });
      statBoxes.push({ type: 'voice', period: '1d', label: 'VOICE (24H)', value: (p1.voiceHours || 0) < 1 ? Math.round((p1.voiceHours || 0)*60)+'m' : (p1.voiceHours || 0).toFixed(1)+'h', subtitle: 'Daily time', color: this.colors.accentPurple });
    }
    
    if (config.show_7d !== false && (p7.messages !== undefined || p7.voiceHours !== undefined)) {
      statBoxes.push({ type: 'messages', period: '7d', label: 'MSGS (7D)', value: (p7.messages || 0).toLocaleString(), subtitle: 'Weekly activity', color: this.colors.accentGreen });
      statBoxes.push({ type: 'voice', period: '7d', label: 'VOICE (7D)', value: (p7.voiceHours || 0) < 1 ? Math.round((p7.voiceHours || 0)*60)+'m' : (p7.voiceHours || 0).toFixed(1)+'h', subtitle: 'Weekly time', color: this.colors.accentPurple });
    }
    
    if (config.show_14d !== false && (p14.messages !== undefined || p14.voiceHours !== undefined)) {
      statBoxes.push({ type: 'messages', period: '14d', label: 'MSGS (14D)', value: (p14.messages || 0).toLocaleString(), subtitle: 'Bi-weekly activity', color: this.colors.accentGreen });
      statBoxes.push({ type: 'voice', period: '14d', label: 'VOICE (14D)', value: (p14.voiceHours || 0) < 1 ? Math.round((p14.voiceHours || 0)*60)+'m' : (p14.voiceHours || 0).toFixed(1)+'h', subtitle: 'Bi-weekly time', color: this.colors.accentPurple });
    }
    
    if (config.show_30d !== false && (p30.messages !== undefined || p30.voiceHours !== undefined)) {
      statBoxes.push({ type: 'messages', period: '30d', label: 'MSGS (30D)', value: (p30.messages || 0).toLocaleString(), subtitle: 'Monthly activity', color: this.colors.accentGreen });
      statBoxes.push({ type: 'voice', period: '30d', label: 'VOICE (30D)', value: (p30.voiceHours || 0) < 1 ? Math.round((p30.voiceHours || 0)*60)+'m' : (p30.voiceHours || 0).toFixed(1)+'h', subtitle: 'Monthly time', color: this.colors.accentPurple });
    }

    // If no boxes enabled, show at least 1d and 7d as fallback
    if (statBoxes.length === 0) {
      statBoxes.push({ type: 'messages', period: '1d', label: 'MSGS (24H)', value: (p1.messages || 0).toLocaleString(), subtitle: 'Daily activity', color: this.colors.accentGreen });
      statBoxes.push({ type: 'messages', period: '7d', label: 'MSGS (7D)', value: (p7.messages || 0).toLocaleString(), subtitle: 'Weekly activity', color: this.colors.accentGreen });
      statBoxes.push({ type: 'voice', period: '1d', label: 'VOICE (24H)', value: (p1.voiceHours || 0) < 1 ? Math.round((p1.voiceHours || 0)*60)+'m' : (p1.voiceHours || 0).toFixed(1)+'h', subtitle: 'Daily time', color: this.colors.accentPurple });
      statBoxes.push({ type: 'voice', period: '7d', label: 'VOICE (7D)', value: (p7.voiceHours || 0) < 1 ? Math.round((p7.voiceHours || 0)*60)+'m' : (p7.voiceHours || 0).toFixed(1)+'h', subtitle: 'Weekly time', color: this.colors.accentPurple });
    }

    const boxH = 90;
    const boxGap = 16;
    const numBoxes = Math.min(statBoxes.length, 4); // Limit to 4 boxes
    const boxW = numBoxes > 1 ? (mainW - (boxGap * (numBoxes - 1))) / numBoxes : mainW;
    
    let sx = col2X;
    const sy = startY + 20; // Slight offset to align with avatar visual weight

    // Draw enabled stat boxes
    for (let i = 0; i < numBoxes; i++) {
      const box = statBoxes[i];
      this.drawStatBox(ctx, sx, sy, boxW, boxH, box.label, box.value, box.subtitle, box.color);
      sx += boxW + boxGap;
    }

    // 2. Large Chart Area (only if enabled)
    if (config.show_charts !== false) {
      const chartY = sy + boxH + 24;
      const chartH = (startY + contentHeight) - chartY - 24; // -24 for footer space
      
      // Use real daily stats data if available
      const mHistory = [];
      const vHistory = [];
      
      if (stats.dailyStats && stats.dailyStats.length > 0) {
        // Use actual daily data
        stats.dailyStats.forEach(day => {
          mHistory.push(day.messages || 0);
          vHistory.push(day.voiceHours || 0);
        });
      } else {
        // Fallback: generate empty data array (all zeros) if no data available
        const lookbackDays = config.lookback_days || 14;
        for(let i = 0; i < lookbackDays; i++) {
          mHistory.push(0);
          vHistory.push(0);
        }
      }
      
      this.drawChart(ctx, col2X, chartY, mainW, chartH, mHistory, vHistory);
    }

    // Footer text
    ctx.fillStyle = this.colors.textMuted;
    ctx.font = '10px "Segoe UI", Arial';
    ctx.textAlign = 'right';
    const lookbackDays = config.lookback_days || 14;
    const timezone = config.timezone || 'UTC';
    ctx.fillText(`Lookback: ${lookbackDays} days • Timezone: ${timezone} • Powered by ComCraft`, this.width - 24, this.height - 12);

    // Draw border with custom color (outside clip)
    ctx.restore(); // Exit clip
    this.roundedRect(ctx, 0, 0, this.width, this.height, this.cornerRadius);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    return cvs.toBuffer('image/png');
  }
}

module.exports = new StatsCardGenerator();
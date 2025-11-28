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
    
    // Modern "Cyber/Dark" color palette
    this.colors = {
      background: '#090c10', // Darker background
      cardBg: 'rgba(22, 27, 34, 0.7)',
      cardBorder: 'rgba(240, 246, 252, 0.1)',
      textPrimary: '#f0f6fc',
      textSecondary: '#8b949e',
      textMuted: '#6e7681',
      
      // Accents
      accentBlue: '#58a6ff',
      accentGreen: '#2ea043', // GitHub green style
      accentPurple: '#bc8cff',
      accentOrange: '#d29922',
      accentRed: '#ff7b72',
      
      // Gradients helpers
      glassWhite: 'rgba(255, 255, 255, 0.05)',
    };
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

    // Background Container
    this.drawContainer(ctx, x, y, width, 80, { bg: 'rgba(0,0,0,0.2)', radius: 12 });

    // "Level" label
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = 'bold 10px "Segoe UI", Arial';
    ctx.textAlign = 'left';
    ctx.fillText('CURRENT LEVEL', x + 16, y + 22);

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

    // XP Text
    ctx.fillStyle = this.colors.textMuted;
    ctx.font = '10px "Segoe UI", Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.floor(xpCurrent)} / ${xpNext} XP`, x + 16, y + 70);
    
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.floor(progress)}%`, x + width - 16, y + 70);

    return y + 95; // Gap
  }

  drawRanksRow(ctx, x, y, width, stats) {
    if (!stats.messageRank && !stats.voiceRank) return y;

    const gap = 12;
    const boxWidth = (width - gap) / 2;
    const height = 60;

    // Message Rank
    if (stats.messageRank) {
      this.drawContainer(ctx, x, y, boxWidth, height, { bg: 'rgba(22, 27, 34, 0.4)', radius: 12 });
      
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '10px "Segoe UI", Arial';
      ctx.textAlign = 'left';
      ctx.fillText('MSG RANK', x + 12, y + 18);

      ctx.fillStyle = this.colors.accentGreen;
      ctx.font = 'bold 24px "Segoe UI", Arial';
      ctx.fillText(`#${stats.messageRank}`, x + 12, y + 46);
    }

    // Voice Rank
    if (stats.voiceRank) {
      const vx = x + boxWidth + gap;
      this.drawContainer(ctx, vx, y, boxWidth, height, { bg: 'rgba(22, 27, 34, 0.4)', radius: 12 });
      
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '10px "Segoe UI", Arial';
      ctx.textAlign = 'left';
      ctx.fillText('VOICE RANK', vx + 12, y + 18);

      ctx.fillStyle = this.colors.accentPurple;
      ctx.font = 'bold 24px "Segoe UI", Arial';
      ctx.fillText(`#${stats.voiceRank}`, vx + 12, y + 46);
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
      grad.addColorStop(0, 'rgba(88, 166, 255, 0.15)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0,0,this.width, this.height);
    }

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
    
    // 2. Ranks (Message & Voice) - Compact Row
    curY = this.drawRanksRow(ctx, col1X, curY, sidebarW, stats);
    
    // 3. Level Bar
    curY = this.drawLevelSection(ctx, col1X, curY, sidebarW, stats);
    
    // 4. Top Channels
    this.drawTopChannels(ctx, col1X, curY, sidebarW, stats.topChannels || []);


    // === RIGHT MAIN AREA ===
    // 1. Stat Cards Grid (2x2 or 4x1) -> Let's do 4x1 horizontal row to look sleek
    const periods = stats.periods || {};
    const p7 = periods['7d'] || {};
    const p1 = periods['1d'] || {};

    const boxH = 90;
    const boxGap = 16;
    const boxW = (mainW - (boxGap * 3)) / 4;
    
    let sx = col2X;
    const sy = startY + 20; // Slight offset to align with avatar visual weight

    // Box 1: Messages 24h
    this.drawStatBox(ctx, sx, sy, boxW, boxH, 
      'MSGS (24H)', 
      (p1.messages || 0).toLocaleString(), 
      'Daily activity', 
      this.colors.accentGreen
    );
    
    // Box 2: Messages 7d
    sx += boxW + boxGap;
    this.drawStatBox(ctx, sx, sy, boxW, boxH, 
      'MSGS (7D)', 
      (p7.messages || 0).toLocaleString(), 
      'Weekly activity', 
      this.colors.accentGreen
    );

    // Box 3: Voice 24h
    sx += boxW + boxGap;
    const voice1d = p1.voiceHours || 0;
    this.drawStatBox(ctx, sx, sy, boxW, boxH, 
      'VOICE (24H)', 
      voice1d < 1 ? Math.round(voice1d*60)+'m' : voice1d.toFixed(1)+'h', 
      'Daily time', 
      this.colors.accentPurple
    );

    // Box 4: Voice 7d
    sx += boxW + boxGap;
    const voice7d = p7.voiceHours || 0;
    this.drawStatBox(ctx, sx, sy, boxW, boxH, 
      'VOICE (7D)', 
      voice7d < 1 ? Math.round(voice7d*60)+'m' : voice7d.toFixed(1)+'h', 
      'Weekly time', 
      this.colors.accentPurple
    );

    // 2. Large Chart Area
    // It takes the remaining height
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
      for(let i = 0; i < 14; i++) {
        mHistory.push(0);
        vHistory.push(0);
      }
    }
    
    this.drawChart(ctx, col2X, chartY, mainW, chartH, mHistory, vHistory);

    // Footer text
    ctx.fillStyle = this.colors.textMuted;
    ctx.font = '10px "Segoe UI", Arial';
    ctx.textAlign = 'right';
    ctx.fillText('Powered by ComCraft', this.width - 24, this.height - 12);

    return cvs.toBuffer('image/png');
  }
}

module.exports = new StatsCardGenerator();
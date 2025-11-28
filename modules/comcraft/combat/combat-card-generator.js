/**
 * Professional Combat Stats Card Generator
 * Modern design matching the stats card style
 */

let canvas = null;
let createCanvas = null;
let loadImage = null;

try {
  canvas = require('canvas');
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
  console.log('[CombatCard] Canvas module loaded successfully');
} catch (error) {
  console.warn('[CombatCard] Canvas module not available.');
}

const axios = require('axios');
const https = require('https');

class CombatCardGenerator {
  constructor() {
    this.width = 1000;
    this.height = 600;
    this.padding = 32;
    this.cornerRadius = 24;
    
    // Combat-themed color palette
    this.colors = {
      background: '#090c10',
      cardBg: 'rgba(22, 27, 34, 0.7)',
      cardBorder: 'rgba(255, 69, 0, 0.3)', // Orange border for combat theme
      textPrimary: '#f0f6fc',
      textSecondary: '#8b949e',
      textMuted: '#6e7681',
      
      // Combat accents
      accentOrange: '#FF4500', // Combat primary
      accentRed: '#ff7b72',
      accentGreen: '#2ea043',
      accentBlue: '#58a6ff',
      accentYellow: '#d29922',
      
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

  drawGlassCard(ctx, x, y, width, height, options = {}) {
    const { radius = 12, bgColor = this.colors.cardBg, borderColor = this.colors.cardBorder } = options;
    
    this.roundedRect(ctx, x, y, width, height, radius);
    ctx.fillStyle = bgColor;
    ctx.fill();
    
    this.roundedRect(ctx, x, y, width, height, radius);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  async generateCombatCard({ user, stats, xpManager }) {
    if (!createCanvas) throw new Error('Canvas missing');
    const cvs = createCanvas(this.width, this.height);
    const ctx = cvs.getContext('2d');
    
    // Save context for border
    ctx.save();
    
    // Background
    this.roundedRect(ctx, 0, 0, this.width, this.height, this.cornerRadius);
    ctx.clip();
    
    // Base background
    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Combat-themed gradient overlay
    const grad = ctx.createRadialGradient(this.width, 0, 0, this.width, 0, 800);
    grad.addColorStop(0, 'rgba(255, 69, 0, 0.15)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Load avatar
    let avatarImage = null;
    if (user.avatarURL) {
      avatarImage = await this.loadImageFromUrl(user.avatarURL.replace('.webp', '.png'));
    }
    
    const padding = this.padding;
    const startY = padding;
    const sidebarW = 280;
    const gap = 24;
    const mainX = padding + sidebarW + gap;
    const mainW = this.width - padding - mainX;
    
    // === LEFT SIDEBAR ===
    let curY = startY;
    
    // Title
    ctx.fillStyle = this.colors.textPrimary;
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('⚔️ Combat Stats', padding, curY);
    curY += 40;
    
    // Avatar
    if (avatarImage) {
      const avatarSize = 120;
      const avatarX = padding + (sidebarW - avatarSize) / 2;
      const avatarY = curY;
      
      // Avatar circle with border
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
      
      // Border
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
      ctx.strokeStyle = this.colors.accentOrange;
      ctx.lineWidth = 3;
      ctx.stroke();
      
      curY += avatarSize + 20;
    }
    
    // Username
    ctx.fillStyle = this.colors.textPrimary;
    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(user.username, padding + sidebarW/2, curY);
    curY += 30;
    
    // Combat Level - Large Display
    const levelCardH = 80;
    this.drawGlassCard(ctx, padding, curY, sidebarW, levelCardH, {
      bgColor: 'rgba(255, 69, 0, 0.15)',
      borderColor: this.colors.accentOrange,
      radius: 12
    });
    
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🏆 Combat Level', padding + 12, curY + 12);
    
    ctx.fillStyle = this.colors.accentOrange;
    ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(stats.combat_level.toString(), padding + 12, curY + 42);
    
    curY += levelCardH + 16;
    
    // XP Progress Card
    const xpForNext = xpManager.xpForNextLevel(stats.combat_level);
    const xpForCurrent = xpManager.xpForLevel(stats.combat_level);
    const currentXP = stats.combat_xp;
    const xpProgress = currentXP - xpForCurrent;
    const xpNeeded = xpForNext - xpForCurrent;
    const progressPercent = xpNeeded > 0 ? (xpProgress / xpNeeded) * 100 : 100;
    
    const xpCardH = 90;
    this.drawGlassCard(ctx, padding, curY, sidebarW, xpCardH, {
      bgColor: this.colors.cardBg,
      borderColor: this.colors.cardBorder,
      radius: 12
    });
    
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('✨ Combat XP', padding + 12, curY + 12);
    
    ctx.fillStyle = this.colors.textPrimary;
    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${this.formatNumber(xpProgress)} / ${this.formatNumber(xpNeeded)}`, padding + 12, curY + 32);
    
    // XP Progress bar
    const barWidth = sidebarW - 24;
    const barHeight = 8;
    const barX = padding + 12;
    const barY = curY + 52;
    
    this.roundedRect(ctx, barX, barY, barWidth, barHeight, 4);
    ctx.fillStyle = 'rgba(110, 118, 129, 0.2)';
    ctx.fill();
    
    if (progressPercent > 0) {
      this.roundedRect(ctx, barX, barY, (progressPercent / 100) * barWidth, barHeight, 4);
      ctx.fillStyle = this.colors.accentOrange;
      ctx.fill();
    }
    
    ctx.fillStyle = this.colors.textMuted;
    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${progressPercent.toFixed(1)}%`, padding + sidebarW - 12, barY + 18);
    
    // === RIGHT MAIN AREA ===
    const mainY = startY;
    let statsY = mainY;
    
    // Stats Grid (2 columns)
    const statBoxW = (mainW - gap) / 2;
    const statBoxH = 90;
    
    // Row 1: Win Rate, Wins, Losses
    let boxX = mainX;
    
    // Win Rate
    this.drawGlassCard(ctx, boxX, statsY, statBoxW, statBoxH, { radius: 12 });
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🎯 Win Rate', boxX + 12, statsY + 12);
    
    const winRate = stats.total_duels > 0 ? ((stats.duels_won / stats.total_duels) * 100).toFixed(1) : 0;
    ctx.fillStyle = this.colors.accentGreen;
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${winRate}%`, boxX + 12, statsY + 40);
    
    ctx.fillStyle = this.colors.textMuted;
    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${stats.duels_won}W / ${stats.duels_lost}L`, boxX + 12, statsY + 65);
    
    // Wins
    boxX += statBoxW + gap;
    this.drawGlassCard(ctx, boxX, statsY, statBoxW, statBoxH, { radius: 12 });
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('✅ Wins', boxX + 12, statsY + 12);
    
    ctx.fillStyle = this.colors.accentGreen;
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(stats.duels_won.toString(), boxX + 12, statsY + 40);
    
    // Row 2: Losses, Win Streak
    statsY += statBoxH + gap;
    boxX = mainX;
    
    // Losses
    this.drawGlassCard(ctx, boxX, statsY, statBoxW, statBoxH, { radius: 12 });
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('❌ Losses', boxX + 12, statsY + 12);
    
    ctx.fillStyle = this.colors.accentRed;
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(stats.duels_lost.toString(), boxX + 12, statsY + 40);
    
    // Win Streak
    boxX += statBoxW + gap;
    this.drawGlassCard(ctx, boxX, statsY, statBoxW, statBoxH, { radius: 12 });
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🔥 Win Streak', boxX + 12, statsY + 12);
    
    ctx.fillStyle = this.colors.accentYellow;
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(stats.current_win_streak.toString(), boxX + 12, statsY + 40);
    
    ctx.fillStyle = this.colors.textMuted;
    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`Best: ${stats.highest_win_streak}`, boxX + 12, statsY + 65);
    
    // Row 3: Damage Dealt, Damage Taken
    statsY += statBoxH + gap;
    boxX = mainX;
    
    // Damage Dealt
    this.drawGlassCard(ctx, boxX, statsY, statBoxW, statBoxH, { radius: 12 });
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('💥 Damage Dealt', boxX + 12, statsY + 12);
    
    ctx.fillStyle = this.colors.accentRed;
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(this.formatNumber(stats.total_damage_dealt || 0), boxX + 12, statsY + 40);
    
    // Damage Taken
    boxX += statBoxW + gap;
    this.drawGlassCard(ctx, boxX, statsY, statBoxW, statBoxH, { radius: 12 });
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🛡️ Damage Taken', boxX + 12, statsY + 12);
    
    ctx.fillStyle = this.colors.accentBlue;
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(this.formatNumber(stats.total_damage_taken || 0), boxX + 12, statsY + 40);
    
    // Combat Bonuses (if level >= 10)
    if (stats.combat_level >= 10) {
      statsY += statBoxH + gap;
      const bonusW = mainW;
      const bonusH = 70;
      
      this.drawGlassCard(ctx, mainX, statsY, bonusW, bonusH, {
        bgColor: 'rgba(255, 69, 0, 0.1)',
        borderColor: this.colors.accentOrange,
        radius: 12
      });
      
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '11px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('💪 Combat Bonuses', mainX + 12, statsY + 12);
      
      const damageBonus = ((xpManager.getDamageMultiplier(stats.combat_level) - 1) * 100).toFixed(1);
      const defenseBonus = ((1 - xpManager.getDefenseMultiplier(stats.combat_level)) * 100).toFixed(2);
      
      ctx.fillStyle = this.colors.textPrimary;
      ctx.font = '16px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`+${damageBonus}% DMG | +${defenseBonus}% DEF`, mainX + 12, statsY + 38);
    }
    
    // Footer
    ctx.fillStyle = this.colors.textMuted;
    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Powered by ComCraft', this.width - padding, this.height - 12);
    
    // Draw border
    ctx.restore(); // Exit clip
    this.roundedRect(ctx, 0, 0, this.width, this.height, this.cornerRadius);
    ctx.strokeStyle = this.colors.accentOrange;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    return cvs.toBuffer('image/png');
  }
}

module.exports = new CombatCardGenerator();


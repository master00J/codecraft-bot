const { createCanvas } = require("@napi-rs/canvas");
const GIFEncoder = require("gif-encoder-2");

/**
 * Slots GIF Generator for Discord Bot
 * 
 * Generates animated slot machine GIFs with spinning reels
 * Uses custom drawn symbols (no emoji dependency)
 */

class SlotsGifGenerator {
  constructor(options = {}) {
    this.width = options.width || 320;
    this.height = options.height || 240; // Taller for 3 rows
    this.frameDelay = options.frameDelay || 80;
    this.spinFrames = options.spinFrames || 35; // Longer spin for better visibility
    this.stopDelay = 6; // Slightly longer delay between reels stopping
    this.resultFrames = options.resultFrames || 12;
    
    // Slot symbols
    this.symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎'];
    
    // Symbol colors
    this.symbolColors = {
      '🍒': { primary: '#FF0000', secondary: '#CC0000', accent: '#00AA00' },
      '🍋': { primary: '#FFE135', secondary: '#CCAA00', accent: '#FFD700' },
      '🍊': { primary: '#FFA500', secondary: '#CC7700', accent: '#FF8C00' },
      '🍇': { primary: '#8B008B', secondary: '#6B006B', accent: '#9932CC' },
      '🔔': { primary: '#FFD700', secondary: '#DAA520', accent: '#B8860B' },
      '⭐': { primary: '#FFD700', secondary: '#FFA500', accent: '#FFFF00' },
      '💎': { primary: '#00BFFF', secondary: '#0080FF', accent: '#87CEEB' },
    };
  }

  /**
   * Draw a cherry symbol
   */
  drawCherry(ctx, x, y, size) {
    const r = size * 0.25;
    
    // Stem
    ctx.strokeStyle = '#00AA00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 1.2);
    ctx.quadraticCurveTo(x, y - r * 2, x + r * 0.8, y - r * 1.5);
    ctx.stroke();
    
    // Left cherry
    ctx.beginPath();
    ctx.arc(x - r * 0.6, y, r, 0, Math.PI * 2);
    const cherryGrad1 = ctx.createRadialGradient(x - r * 0.8, y - r * 0.3, 0, x - r * 0.6, y, r);
    cherryGrad1.addColorStop(0, '#FF6666');
    cherryGrad1.addColorStop(0.7, '#FF0000');
    cherryGrad1.addColorStop(1, '#CC0000');
    ctx.fillStyle = cherryGrad1;
    ctx.fill();
    ctx.strokeStyle = '#990000';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Right cherry
    ctx.beginPath();
    ctx.arc(x + r * 0.6, y + r * 0.3, r, 0, Math.PI * 2);
    const cherryGrad2 = ctx.createRadialGradient(x + r * 0.4, y, 0, x + r * 0.6, y + r * 0.3, r);
    cherryGrad2.addColorStop(0, '#FF6666');
    cherryGrad2.addColorStop(0.7, '#FF0000');
    cherryGrad2.addColorStop(1, '#CC0000');
    ctx.fillStyle = cherryGrad2;
    ctx.fill();
    ctx.strokeStyle = '#990000';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(x - r * 0.8, y - r * 0.3, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw a lemon symbol
   */
  drawLemon(ctx, x, y, size) {
    const r = size * 0.35;
    
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, Math.PI * 0.1, 0, Math.PI * 2);
    const lemonGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.2, 0, x, y, r);
    lemonGrad.addColorStop(0, '#FFFF66');
    lemonGrad.addColorStop(0.6, '#FFE135');
    lemonGrad.addColorStop(1, '#CCAA00');
    ctx.fillStyle = lemonGrad;
    ctx.fill();
    ctx.strokeStyle = '#AA8800';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Tips
    ctx.beginPath();
    ctx.ellipse(x - r * 0.9, y - r * 0.1, r * 0.2, r * 0.15, Math.PI * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#CCAA00';
    ctx.fill();
    
    ctx.beginPath();
    ctx.ellipse(x + r * 0.9, y + r * 0.1, r * 0.2, r * 0.15, Math.PI * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw an orange symbol
   */
  drawOrange(ctx, x, y, size) {
    const r = size * 0.32;
    
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    const orangeGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    orangeGrad.addColorStop(0, '#FFCC66');
    orangeGrad.addColorStop(0.5, '#FFA500');
    orangeGrad.addColorStop(1, '#CC7700');
    ctx.fillStyle = orangeGrad;
    ctx.fill();
    ctx.strokeStyle = '#995500';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Leaf
    ctx.beginPath();
    ctx.ellipse(x, y - r * 1.1, r * 0.25, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#228B22';
    ctx.fill();
    
    // Texture dots
    ctx.fillStyle = 'rgba(255,200,100,0.3)';
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const dotX = x + Math.cos(angle) * r * 0.5;
      const dotY = y + Math.sin(angle) * r * 0.5;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draw grapes symbol
   */
  drawGrapes(ctx, x, y, size) {
    const r = size * 0.12;
    const grapeColor = ctx.createRadialGradient(x, y, 0, x, y, size * 0.4);
    grapeColor.addColorStop(0, '#9932CC');
    grapeColor.addColorStop(1, '#6B006B');
    
    // Grape positions (triangle pattern)
    const positions = [
      [0, -r * 2.2],
      [-r * 1.1, -r * 0.8], [r * 1.1, -r * 0.8],
      [-r * 1.8, r * 0.5], [0, r * 0.5], [r * 1.8, r * 0.5],
      [-r * 1.1, r * 1.8], [r * 1.1, r * 1.8],
    ];
    
    positions.forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fillStyle = grapeColor;
      ctx.fill();
      ctx.strokeStyle = '#4B0082';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(x + dx - r * 0.3, y + dy - r * 0.3, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Stem
    ctx.strokeStyle = '#228B22';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 2.2);
    ctx.lineTo(x, y - r * 3.5);
    ctx.stroke();
  }

  /**
   * Draw bell symbol
   */
  drawBell(ctx, x, y, size) {
    const r = size * 0.35;
    
    // Bell body
    ctx.beginPath();
    ctx.moveTo(x - r * 0.8, y + r * 0.5);
    ctx.quadraticCurveTo(x - r * 0.9, y - r * 0.5, x - r * 0.3, y - r * 0.8);
    ctx.quadraticCurveTo(x, y - r * 1.1, x + r * 0.3, y - r * 0.8);
    ctx.quadraticCurveTo(x + r * 0.9, y - r * 0.5, x + r * 0.8, y + r * 0.5);
    ctx.lineTo(x - r * 0.8, y + r * 0.5);
    
    const bellGrad = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    bellGrad.addColorStop(0, '#FFE066');
    bellGrad.addColorStop(0.5, '#FFD700');
    bellGrad.addColorStop(1, '#B8860B');
    ctx.fillStyle = bellGrad;
    ctx.fill();
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Bell rim
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.5, r * 0.85, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#DAA520';
    ctx.fill();
    ctx.stroke();
    
    // Clapper
    ctx.beginPath();
    ctx.arc(x, y + r * 0.7, r * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#8B6914';
    ctx.fill();
    
    // Top knob
    ctx.beginPath();
    ctx.arc(x, y - r * 0.95, r * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#DAA520';
    ctx.fill();
    ctx.stroke();
  }

  /**
   * Draw star symbol
   */
  drawStar(ctx, x, y, size) {
    const outerR = size * 0.38;
    const innerR = outerR * 0.45;
    const spikes = 5;
    
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i * Math.PI / spikes) - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    
    const starGrad = ctx.createRadialGradient(x, y, 0, x, y, outerR);
    starGrad.addColorStop(0, '#FFFF66');
    starGrad.addColorStop(0.5, '#FFD700');
    starGrad.addColorStop(1, '#FFA500');
    ctx.fillStyle = starGrad;
    ctx.fill();
    ctx.strokeStyle = '#CC8800';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Inner glow
    ctx.beginPath();
    ctx.arc(x, y, innerR * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,200,0.5)';
    ctx.fill();
  }

  /**
   * Draw diamond symbol
   */
  drawDiamond(ctx, x, y, size) {
    const w = size * 0.35;
    const h = size * 0.45;
    
    // Main diamond shape
    ctx.beginPath();
    ctx.moveTo(x, y - h);           // Top
    ctx.lineTo(x + w, y);           // Right
    ctx.lineTo(x, y + h);           // Bottom
    ctx.lineTo(x - w, y);           // Left
    ctx.closePath();
    
    const diamondGrad = ctx.createLinearGradient(x - w, y - h, x + w, y + h);
    diamondGrad.addColorStop(0, '#87CEEB');
    diamondGrad.addColorStop(0.3, '#00BFFF');
    diamondGrad.addColorStop(0.5, '#FFFFFF');
    diamondGrad.addColorStop(0.7, '#00BFFF');
    diamondGrad.addColorStop(1, '#0080FF');
    ctx.fillStyle = diamondGrad;
    ctx.fill();
    ctx.strokeStyle = '#0066CC';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Facet lines
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x - w * 0.5, y - h * 0.3);
    ctx.lineTo(x, y + h * 0.2);
    ctx.lineTo(x + w * 0.5, y - h * 0.3);
    ctx.lineTo(x, y - h);
    ctx.stroke();
    
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3, y - h * 0.5);
    ctx.lineTo(x, y - h * 0.7);
    ctx.lineTo(x + w * 0.1, y - h * 0.4);
    ctx.lineTo(x - w * 0.1, y - h * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw symbol by type
   */
  drawSymbol(ctx, symbol, x, y, size = 45, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    
    switch (symbol) {
      case '🍒': this.drawCherry(ctx, x, y, size); break;
      case '🍋': this.drawLemon(ctx, x, y, size); break;
      case '🍊': this.drawOrange(ctx, x, y, size); break;
      case '🍇': this.drawGrapes(ctx, x, y, size); break;
      case '🔔': this.drawBell(ctx, x, y, size); break;
      case '⭐': this.drawStar(ctx, x, y, size); break;
      case '💎': this.drawDiamond(ctx, x, y, size); break;
      default: this.drawStar(ctx, x, y, size); break;
    }
    
    ctx.restore();
  }

  /**
   * Draw slot machine background
   */
  drawBackground(ctx) {
    // Dark casino background
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#1a0a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f0f23');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Slot machine frame (taller for 3 rows)
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(20, 40, this.width - 40, 150);
    
    // Gold trim
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 40, this.width - 40, 150);
    
    // Inner frame (darker)
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(30, 50, this.width - 60, 130);
    
    // Reel backgrounds (darker slots)
    const reelWidth = (this.width - 60) / 3;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#0d0d1a';
      ctx.fillRect(32 + i * reelWidth, 52, reelWidth - 4, 126);
    }
    
    // Reel dividers (vertical)
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30 + reelWidth, 50);
    ctx.lineTo(30 + reelWidth, 180);
    ctx.moveTo(30 + reelWidth * 2, 50);
    ctx.lineTo(30 + reelWidth * 2, 180);
    ctx.stroke();
    
    // Row dividers (horizontal lines between rows)
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 50 + 43); // Between row 1 and 2
    ctx.lineTo(this.width - 30, 50 + 43);
    ctx.moveTo(30, 50 + 86); // Between row 2 and 3
    ctx.lineTo(this.width - 30, 50 + 86);
    ctx.stroke();
  }

  /**
   * Draw a spinning reel with 3 rows scrolling
   */
  drawSpinningReel(ctx, x, frame, reelIndex = 0) {
    const symbolSize = 40;
    const rowSpacing = 35;
    const scrollSpeed = 15;
    const baseY = 80; // Start Y for top row
    
    // Calculate vertical offset for scrolling
    const totalOffset = (frame * scrollSpeed) % rowSpacing;
    
    // Draw 3 rows, each scrolling independently
    for (let row = 0; row < 3; row++) {
      const rowY = baseY + (row * rowSpacing);
      
      // Draw multiple symbols scrolling for this row
      for (let i = -1; i <= 2; i++) {
        const symbolPos = Math.floor((frame * scrollSpeed) / rowSpacing) + i + (reelIndex * 3) + (row * 2);
        const symbolIndex = Math.abs(symbolPos) % this.symbols.length;
        const symbol = this.symbols[symbolIndex];
        
        const yPos = rowY + (i * rowSpacing) - totalOffset;
        
        // Only draw if in visible area
        if (yPos >= 55 && yPos <= 180) {
          // Blur/fade effect for spinning
          const distFromCenter = Math.abs(yPos - rowY);
          const alpha = Math.max(0.3, 1 - distFromCenter / 40);
          this.drawSymbol(ctx, symbol, x, yPos, symbolSize, alpha * 0.8);
        }
      }
    }
    
    // Motion blur overlay
    ctx.fillStyle = 'rgba(13,13,26,0.2)';
    ctx.fillRect(x - 40, 52, 80, 130);
  }

  /**
   * Draw a stopped reel with 3 rows (3x3 grid)
   */
  drawStoppedReel(ctx, x, reelIndex, symbols, highlightRows = []) {
    // symbols is array of 3 symbols [top, middle, bottom]
    // highlightRows is array of row indices to highlight [0, 1, 2]
    const rowSpacing = 35;
    const baseY = 80; // Start Y position for top row
    
    for (let row = 0; row < 3; row++) {
      const y = baseY + (row * rowSpacing);
      const symbol = symbols[row];
      const isHighlighted = highlightRows.includes(row);
      
      if (isHighlighted) {
        // Glow effect for winning symbols
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 15;
        
        // Background highlight
        ctx.fillStyle = 'rgba(255,215,0,0.2)';
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.fill();
      }
      
      this.drawSymbol(ctx, symbol, x, y, 40, 1);
      ctx.shadowBlur = 0;
    }
  }

  /**
   * Draw player info
   */
  drawPlayerInfo(ctx, playerName, betAmount) {
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    
    const displayName = playerName.length > 15 ? playerName.substring(0, 14) + '…' : playerName;
    ctx.strokeText(displayName, this.width / 2, 25);
    ctx.fillText(displayName, this.width / 2, 25);
    
    ctx.font = 'bold 12px Arial';
    const betText = `Bet: ${betAmount.toLocaleString()} coins`;
    ctx.strokeText(betText, this.width / 2, this.height - 15);
    ctx.fillText(betText, this.width / 2, this.height - 15);
  }

  /**
   * Draw result text
   */
  drawResult(ctx, result, multiplier, winAmount, frame) {
    const pulse = 1 + Math.sin(frame * 0.5) * 0.1;
    
    ctx.save();
    ctx.translate(this.width / 2, this.height - 40);
    ctx.scale(pulse, pulse);
    
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    
    if (result === 'win') {
      if (multiplier >= 10) {
        ctx.fillStyle = '#FF00FF';
        ctx.strokeText('JACKPOT!', 0, 0);
        ctx.fillText('JACKPOT!', 0, 0);
      } else if (multiplier >= 5) {
        ctx.fillStyle = '#FFD700';
        ctx.strokeText('BIG WIN!', 0, 0);
        ctx.fillText('BIG WIN!', 0, 0);
      } else {
        ctx.fillStyle = '#00FF00';
        ctx.strokeText('WIN!', 0, 0);
        ctx.fillText('WIN!', 0, 0);
      }
      
      ctx.font = 'bold 14px Arial';
      ctx.fillStyle = '#00FF00';
      ctx.strokeText(`+${winAmount.toLocaleString()}`, 0, 20);
      ctx.fillText(`+${winAmount.toLocaleString()}`, 0, 20);
    } else {
      ctx.fillStyle = '#FF4444';
      ctx.strokeText('No Win', 0, 0);
      ctx.fillText('No Win', 0, 0);
    }
    
    ctx.restore();
  }

  /**
   * Get which rows to highlight for a specific reel based on winning lines
   */
  getHighlightRowsForReel(winningLines, reelIndex) {
    const highlightRows = [];
    
    for (const line of winningLines) {
      if (line.row === 0) highlightRows.push(0); // Top row
      if (line.row === 1) highlightRows.push(1); // Middle row
      if (line.row === 2) highlightRows.push(2); // Bottom row
      
      // Diagonals affect all reels
      if (line.name === 'Diagonal ↘') {
        if (reelIndex === 0) highlightRows.push(0);
        if (reelIndex === 1) highlightRows.push(1);
        if (reelIndex === 2) highlightRows.push(2);
      }
      if (line.name === 'Diagonal ↙') {
        if (reelIndex === 0) highlightRows.push(2);
        if (reelIndex === 1) highlightRows.push(1);
        if (reelIndex === 2) highlightRows.push(0);
      }
    }
    
    return [...new Set(highlightRows)]; // Remove duplicates
  }

  /**
   * Draw winning lines on the slot machine
   */
  drawWinningLines(ctx, winningLines, reelX) {
    const baseY = 80;
    const rowSpacing = 35;
    
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    
    for (const line of winningLines) {
      ctx.beginPath();
      
      if (line.row === 0) {
        // Top row
        ctx.moveTo(reelX[0] - 30, baseY);
        ctx.lineTo(reelX[2] + 30, baseY);
      } else if (line.row === 1) {
        // Middle row
        ctx.moveTo(reelX[0] - 30, baseY + rowSpacing);
        ctx.lineTo(reelX[2] + 30, baseY + rowSpacing);
      } else if (line.row === 2) {
        // Bottom row
        ctx.moveTo(reelX[0] - 30, baseY + rowSpacing * 2);
        ctx.lineTo(reelX[2] + 30, baseY + rowSpacing * 2);
      } else if (line.name === 'Diagonal ↘') {
        // Diagonal top-left to bottom-right
        ctx.moveTo(reelX[0] - 30, baseY);
        ctx.lineTo(reelX[1], baseY + rowSpacing);
        ctx.lineTo(reelX[2] + 30, baseY + rowSpacing * 2);
      } else if (line.name === 'Diagonal ↙') {
        // Diagonal top-right to bottom-left
        ctx.moveTo(reelX[2] + 30, baseY);
        ctx.lineTo(reelX[1], baseY + rowSpacing);
        ctx.lineTo(reelX[0] - 30, baseY + rowSpacing * 2);
      }
      
      ctx.stroke();
    }
    
    ctx.setLineDash([]);
  }

  /**
   * Generate slots GIF
   */
  async spin(options) {
    const {
      playerName = "Player",
      reels, // Now 3x3: [[row1, row2, row3], [row1, row2, row3], [row1, row2, row3]]
      result = 'loss',
      multiplier = 0,
      betAmount = 1000,
      winAmount = 0,
      winningLines = [], // Array of winning line info
    } = options;

    const encoder = new GIFEncoder(this.width, this.height);
    encoder.setDelay(this.frameDelay);
    encoder.setRepeat(0);
    encoder.setQuality(10);
    encoder.start();

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d");

    const reelWidth = (this.width - 60) / 3;
    const reelX = [
      30 + reelWidth / 2,
      30 + reelWidth + reelWidth / 2,
      30 + reelWidth * 2 + reelWidth / 2,
    ];

    const reel1StopFrame = this.spinFrames;
    const reel2StopFrame = this.spinFrames + this.stopDelay;
    const reel3StopFrame = this.spinFrames + this.stopDelay * 2;
    const totalSpinFrames = reel3StopFrame + 2;

    // Spinning animation
    for (let frame = 0; frame < totalSpinFrames; frame++) {
      this.drawBackground(ctx);
      this.drawPlayerInfo(ctx, playerName, betAmount);

      for (let r = 0; r < 3; r++) {
        const stopFrame = r === 0 ? reel1StopFrame : r === 1 ? reel2StopFrame : reel3StopFrame;
        
        if (frame < stopFrame) {
          // Still spinning
          this.drawSpinningReel(ctx, reelX[r], frame + r * 7, r);
        } else {
          // Stopped - show final symbols for this reel
          const reelSymbols = reels[r]; // [top, middle, bottom]
          const highlightRows = frame >= totalSpinFrames - 1 ? this.getHighlightRowsForReel(winningLines, r) : [];
          this.drawStoppedReel(ctx, reelX[r], r, reelSymbols, highlightRows);
        }
      }

      if (frame < totalSpinFrames - 2) {
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#888';
        ctx.fillText('Spinning...', this.width / 2, this.height - 40);
      }

      encoder.addFrame(ctx.getImageData(0, 0, this.width, this.height).data);
    }

    // Result frames
    for (let frame = 0; frame < this.resultFrames; frame++) {
      this.drawBackground(ctx);
      this.drawPlayerInfo(ctx, playerName, betAmount);

      // Draw all reels stopped
      for (let r = 0; r < 3; r++) {
        const reelSymbols = reels[r];
        const highlightRows = result === 'win' ? this.getHighlightRowsForReel(winningLines, r) : [];
        this.drawStoppedReel(ctx, reelX[r], r, reelSymbols, highlightRows);
      }

      // Draw winning lines
      if (result === 'win' && winningLines.length > 0) {
        this.drawWinningLines(ctx, winningLines, reelX);
      }

      this.drawResult(ctx, result, multiplier, winAmount, frame);

      encoder.addFrame(ctx.getImageData(0, 0, this.width, this.height).data);
    }

    encoder.finish();

    return {
      buffer: encoder.out.getData(),
      reels,
      result,
      multiplier,
      winAmount,
    };
  }
}

// Test
if (require.main === module) {
  async function main() {
    const generator = new SlotsGifGenerator();

    console.log("Generating slots GIF...");
    const result = await generator.spin({
      playerName: "jasonn3670",
      reels: ['💎', '💎', '💎'],
      result: 'win',
      multiplier: 10,
      betAmount: 50000,
      winAmount: 475000,
    });

    require('fs').writeFileSync("slots-test.gif", result.buffer);
    console.log(`Saved: slots-test.gif`);
  }

  main().catch(console.error);
}

module.exports = SlotsGifGenerator;
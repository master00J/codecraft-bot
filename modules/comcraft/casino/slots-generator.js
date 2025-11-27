const { createCanvas } = require("@napi-rs/canvas");
const GIFEncoder = require("gif-encoder-2");

/**
 * Slots GIF Generator for Discord Bot
 * 
 * Generates animated slot machine GIFs with spinning reels
 */

class SlotsGifGenerator {
  constructor(options = {}) {
    this.width = options.width || 320;
    this.height = options.height || 200;
    this.frameDelay = options.frameDelay || 80;
    this.spinFrames = options.spinFrames || 20; // Frames of spinning
    this.stopDelay = 4; // Frames between each reel stopping
    this.resultFrames = options.resultFrames || 12;
    
    // Slot symbols (must match manager.js)
    this.symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎'];
    
    // Symbol colors for drawing
    this.symbolColors = {
      '🍒': '#FF0000',
      '🍋': '#FFD700',
      '🍊': '#FFA500',
      '🍇': '#8B008B',
      '🔔': '#FFD700',
      '⭐': '#FFD700',
      '💎': '#00BFFF',
    };
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

    // Slot machine frame
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(20, 40, this.width - 40, 110);
    
    // Gold trim
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 40, this.width - 40, 110);
    
    // Inner frame (darker)
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(30, 50, this.width - 60, 90);
    
    // Reel dividers
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    const reelWidth = (this.width - 60) / 3;
    ctx.beginPath();
    ctx.moveTo(30 + reelWidth, 50);
    ctx.lineTo(30 + reelWidth, 140);
    ctx.moveTo(30 + reelWidth * 2, 50);
    ctx.lineTo(30 + reelWidth * 2, 140);
    ctx.stroke();
  }

  /**
   * Draw a symbol at position
   */
  drawSymbol(ctx, symbol, x, y, size = 40, blur = false) {
    ctx.save();
    
    if (blur) {
      ctx.globalAlpha = 0.5;
    }
    
    ctx.font = `${size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, x, y);
    
    ctx.restore();
  }

  /**
   * Draw a spinning reel (blur effect)
   */
  drawSpinningReel(ctx, x, y, frame) {
    // Draw multiple blurred symbols to simulate spinning
    const symbolSize = 35;
    const offset = (frame * 15) % 60;
    
    for (let i = -1; i <= 2; i++) {
      const symbolIndex = Math.floor(Math.random() * this.symbols.length);
      const symbol = this.symbols[symbolIndex];
      const yPos = y + (i * 30) + offset - 30;
      
      if (yPos > 50 && yPos < 140) {
        this.drawSymbol(ctx, symbol, x, yPos, symbolSize, true);
      }
    }
    
    // Motion blur lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 20, 60 + i * 25);
      ctx.lineTo(x + 20, 60 + i * 25);
      ctx.stroke();
    }
  }

  /**
   * Draw a stopped reel with final symbol
   */
  drawStoppedReel(ctx, x, y, symbol, highlight = false) {
    if (highlight) {
      // Glow effect for winning symbols
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 15;
    }
    
    this.drawSymbol(ctx, symbol, x, y, 40);
    
    ctx.shadowBlur = 0;
  }

  /**
   * Draw player info
   */
  drawPlayerInfo(ctx, playerName, betAmount) {
    // Player name at top
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    
    const displayName = playerName.length > 15 ? playerName.substring(0, 14) + '…' : playerName;
    ctx.strokeText(displayName, this.width / 2, 25);
    ctx.fillText(displayName, this.width / 2, 25);
    
    // Bet amount at bottom
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#FFD700';
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
        ctx.strokeText('🎰 JACKPOT! 🎰', 0, 0);
        ctx.fillText('🎰 JACKPOT! 🎰', 0, 0);
      } else if (multiplier >= 5) {
        ctx.fillStyle = '#FFD700';
        ctx.strokeText('⭐ BIG WIN! ⭐', 0, 0);
        ctx.fillText('⭐ BIG WIN! ⭐', 0, 0);
      } else {
        ctx.fillStyle = '#00FF00';
        ctx.strokeText('WIN!', 0, 0);
        ctx.fillText('WIN!', 0, 0);
      }
      
      // Win amount
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
   * Generate slots GIF
   */
  async spin(options) {
    const {
      playerName = "Player",
      reels, // Array of 3 symbols [reel1, reel2, reel3]
      result = 'loss',
      multiplier = 0,
      betAmount = 1000,
      winAmount = 0,
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
    const reelY = 95; // Center of reel area

    // Calculate when each reel stops
    const reel1StopFrame = this.spinFrames;
    const reel2StopFrame = this.spinFrames + this.stopDelay;
    const reel3StopFrame = this.spinFrames + this.stopDelay * 2;
    const totalSpinFrames = reel3StopFrame + 2;

    // Phase 1: Spinning animation
    for (let frame = 0; frame < totalSpinFrames; frame++) {
      this.drawBackground(ctx);
      this.drawPlayerInfo(ctx, playerName, betAmount);

      // Draw each reel
      for (let r = 0; r < 3; r++) {
        const stopFrame = r === 0 ? reel1StopFrame : r === 1 ? reel2StopFrame : reel3StopFrame;
        
        if (frame < stopFrame) {
          // Still spinning
          this.drawSpinningReel(ctx, reelX[r], reelY, frame + r * 5);
        } else {
          // Stopped - show final symbol
          const isWinningSymbol = this.isWinningPosition(reels, r);
          this.drawStoppedReel(ctx, reelX[r], reelY, reels[r], isWinningSymbol && frame >= totalSpinFrames - 1);
        }
      }

      // "Spinning..." text during spin
      if (frame < totalSpinFrames - 2) {
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#888';
        ctx.fillText('Spinning...', this.width / 2, this.height - 40);
      }

      encoder.addFrame(ctx.getImageData(0, 0, this.width, this.height).data);
    }

    // Phase 2: Result display
    for (let frame = 0; frame < this.resultFrames; frame++) {
      this.drawBackground(ctx);
      this.drawPlayerInfo(ctx, playerName, betAmount);

      // Draw all reels stopped with win highlighting
      for (let r = 0; r < 3; r++) {
        const isWinningSymbol = this.isWinningPosition(reels, r);
        this.drawStoppedReel(ctx, reelX[r], reelY, reels[r], isWinningSymbol && result === 'win');
      }

      // Draw result
      this.drawResult(ctx, result, multiplier, winAmount, frame);

      // Win line for matching symbols
      if (result === 'win') {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(40, reelY);
        ctx.lineTo(this.width - 40, reelY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

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

  /**
   * Check if a reel position is part of a winning combination
   */
  isWinningPosition(reels, position) {
    const [r1, r2, r3] = reels;
    
    // Three of a kind - all positions win
    if (r1 === r2 && r2 === r3) {
      return true;
    }
    
    // Two of a kind - only matching positions win
    if (r1 === r2 && (position === 0 || position === 1)) return true;
    if (r2 === r3 && (position === 1 || position === 2)) return true;
    if (r1 === r3 && (position === 0 || position === 2)) return true;
    
    return false;
  }
}

// Test if run directly
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
    console.log(`Saved: slots-test.gif (${result.buffer.length} bytes)`);
  }

  main().catch(console.error);
}

module.exports = SlotsGifGenerator;


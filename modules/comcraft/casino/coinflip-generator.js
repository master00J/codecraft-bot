const { createCanvas } = require("@napi-rs/canvas");
const GIFEncoder = require("gif-encoder-2");

/**
 * OSRS-Style Coinflip GIF Generator for Discord Bot
 *
 * Generates animated coinflip GIFs with:
 * - Gold coin with flip animation
 * - Heads/Tails result
 * - Player names and bet amount
 */

class CoinflipGenerator {
  constructor(options = {}) {
    this.width = options.width || 300;
    this.height = options.height || 180;
    this.frameDelay = options.frameDelay || 70;
  }

  /**
   * Draw OSRS-style gold coin
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - center x
   * @param {number} y - center y
   * @param {number} radius - coin radius
   * @param {number} scaleX - horizontal scale (for flip effect, -1 to 1)
   * @param {string} side - 'heads' or 'tails'
   */
  drawCoin(ctx, x, y, radius, scaleX, side) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scaleX, 1);

    // Determine which side is showing based on scaleX
    const showingHeads = scaleX > 0 ? side === "heads" : side !== "heads";
    const absScale = Math.abs(scaleX);

    // Coin edge (darker gold) - only visible when coin is angled
    if (absScale < 0.9) {
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#8B6914";
      ctx.fill();
      ctx.strokeStyle = "#5C4510";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Main coin face
    const coinRadius = radius * 0.95;

    // Outer ring (darker gold border)
    ctx.beginPath();
    ctx.ellipse(0, 0, coinRadius, coinRadius, 0, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(
      -coinRadius * 0.3,
      -coinRadius * 0.3,
      0,
      0,
      0,
      coinRadius
    );
    gradient.addColorStop(0, "#FFD700");
    gradient.addColorStop(0.5, "#FFC125");
    gradient.addColorStop(0.8, "#DAA520");
    gradient.addColorStop(1, "#B8860B");
    ctx.fillStyle = gradient;
    ctx.fill();

    // Coin border
    ctx.strokeStyle = "#8B6914";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner circle border
    ctx.beginPath();
    ctx.ellipse(0, 0, coinRadius * 0.85, coinRadius * 0.85, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#B8860B";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Only draw details if coin is mostly facing us
    if (absScale > 0.3) {
      if (showingHeads) {
        // HEADS - Draw a crown or "H"
        this.drawHeadsSide(ctx, coinRadius * 0.6);
      } else {
        // TAILS - Draw dragon or "T"
        this.drawTailsSide(ctx, coinRadius * 0.6);
      }
    }

    // Shine effect
    ctx.beginPath();
    ctx.ellipse(
      -coinRadius * 0.25,
      -coinRadius * 0.25,
      coinRadius * 0.2,
      coinRadius * 0.15,
      -Math.PI / 4,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw heads side design (crown/H)
   */
  drawHeadsSide(ctx, size) {
    ctx.fillStyle = "#8B6914";
    ctx.strokeStyle = "#6B4F12";
    ctx.lineWidth = 2;

    // Draw "H" for Heads in OSRS style
    ctx.font = `bold ${size * 1.2}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText("H", 0, 0);
    ctx.fillText("H", 0, 0);

    // Small crown above
    const crownY = -size * 0.5;
    const crownSize = size * 0.4;

    ctx.beginPath();
    ctx.moveTo(-crownSize, crownY + crownSize * 0.5);
    ctx.lineTo(-crownSize, crownY);
    ctx.lineTo(-crownSize * 0.5, crownY + crownSize * 0.3);
    ctx.lineTo(0, crownY - crownSize * 0.2);
    ctx.lineTo(crownSize * 0.5, crownY + crownSize * 0.3);
    ctx.lineTo(crownSize, crownY);
    ctx.lineTo(crownSize, crownY + crownSize * 0.5);
    ctx.closePath();
    ctx.fillStyle = "#8B6914";
    ctx.fill();
    ctx.stroke();
  }

  /**
   * Draw tails side design (dragon/T)
   */
  drawTailsSide(ctx, size) {
    ctx.fillStyle = "#8B6914";
    ctx.strokeStyle = "#6B4F12";
    ctx.lineWidth = 2;

    // Draw "T" for Tails in OSRS style
    ctx.font = `bold ${size * 1.2}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText("T", 0, 0);
    ctx.fillText("T", 0, 0);

    // Small dragon wing shapes
    const wingY = -size * 0.4;

    // Left wing
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, wingY);
    ctx.quadraticCurveTo(
      -size * 0.8,
      wingY - size * 0.3,
      -size * 0.6,
      wingY + size * 0.2
    );
    ctx.strokeStyle = "#8B6914";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Right wing
    ctx.beginPath();
    ctx.moveTo(size * 0.3, wingY);
    ctx.quadraticCurveTo(
      size * 0.8,
      wingY - size * 0.3,
      size * 0.6,
      wingY + size * 0.2
    );
    ctx.stroke();
  }

  /**
   * Draw player name with OSRS style
   */
  drawName(ctx, name, x, y, color = "#ffff00") {
    const displayName = name.length > 12 ? name.substring(0, 11) + "…" : name;
    ctx.fillStyle = color;
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.strokeText(displayName, x, y);
    ctx.fillText(displayName, x, y);
  }

  /**
   * Draw bet amount
   */
  drawBet(ctx, amount, x, y) {
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    const text = `${amount.toLocaleString()} coins`;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  /**
   * Draw result text
   */
  drawResult(ctx, result, isWin) {
    // Background banner
    const bannerY = this.height - 35;
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, bannerY - 15, this.width, 40);

    // Result text
    ctx.fillStyle = isWin ? "#00ff00" : "#ff4444";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;

    const resultText = isWin
      ? `${result.toUpperCase()}! YOU WIN!`
      : `${result.toUpperCase()}! You lose...`;
    ctx.strokeText(resultText, this.width / 2, bannerY + 5);
    ctx.fillText(resultText, this.width / 2, bannerY + 5);
  }

  /**
   * Generate coinflip GIF (solo vs house)
   */
  async generateCoinflipGif(options) {
    const {
      playerName,
      playerChoice = "heads", // player picks heads or tails
      result, // 'heads' or 'tails' - predetermined
      betAmount = 1000,
    } = options;

    const isWin = playerChoice === result;

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d");

    const coinX = this.width / 2;
    const coinY = this.height / 2 - 5;
    const coinRadius = 45;

    // Animation phases
    const totalFlips = 5; // Number of full rotations
    const flipFrames = 28;
    const restFrames = 4;
    const landFrames = 6;
    const resultFrames = 12;

    // Create encoder (same approach as duel-generator which works)
    const encoder = new GIFEncoder(this.width, this.height);
    encoder.setDelay(this.frameDelay);
    encoder.setRepeat(0);
    encoder.setQuality(10);
    encoder.start();

    // Helper to add frame
    const addFrame = () => {
      encoder.addFrame(ctx.getImageData(0, 0, this.width, this.height).data);
    };

    // Phase 1: Rest (coin at start)
    for (let i = 0; i < restFrames; i++) {
      this.drawBackground(ctx);
      this.drawPlayerInfo(ctx, playerName, playerChoice, betAmount);
      this.drawCoin(ctx, coinX, coinY, coinRadius, 1, "heads");
      this.drawFlipPrompt(ctx, "Flipping...");
      addFrame();
    }

    // Phase 2: Flipping
    for (let i = 0; i < flipFrames; i++) {
      this.drawBackground(ctx);
      this.drawPlayerInfo(ctx, playerName, playerChoice, betAmount);

      // Calculate rotation progress
      const progress = i / flipFrames;
      const totalRotation = totalFlips * Math.PI * 2;
      const angle = progress * totalRotation;

      // scaleX oscillates between -1 and 1
      const scaleX = Math.cos(angle);

      // Add vertical bounce
      const bounce = Math.sin(progress * Math.PI) * 35;
      const currentY = coinY - bounce;

      // Determine which side based on rotation
      const rotationCount = Math.floor(angle / Math.PI);
      const currentSide = rotationCount % 2 === 0 ? "heads" : "tails";

      this.drawCoin(ctx, coinX, currentY, coinRadius, scaleX, currentSide);
      this.drawFlipPrompt(ctx, "Flipping...");
      addFrame();
    }

    // Phase 3: Landing animation
    for (let i = 0; i < landFrames; i++) {
      this.drawBackground(ctx);
      this.drawPlayerInfo(ctx, playerName, playerChoice, betAmount);

      // Wobble effect as coin lands
      const wobble =
        Math.cos((i / landFrames) * Math.PI * 3) * (1 - i / landFrames) * 0.3;
      const scaleX = 1 - Math.abs(wobble);

      // Small bounce
      const bounce =
        Math.sin((i / landFrames) * Math.PI) * 10 * (1 - i / landFrames);

      this.drawCoin(ctx, coinX, coinY - bounce, coinRadius, scaleX, result);
      this.drawFlipPrompt(ctx, "Landing...");
      addFrame();
    }

    // Phase 4: Result
    for (let i = 0; i < resultFrames; i++) {
      this.drawBackground(ctx);
      this.drawPlayerInfo(ctx, playerName, playerChoice, betAmount);
      this.drawCoin(ctx, coinX, coinY, coinRadius, 1, result);
      this.drawResult(ctx, result, isWin);
      addFrame();
    }

    encoder.finish();
    
    // Return buffer directly (same as duel-generator)
    try {
      const buffer = encoder.out.getData();
      if (!buffer || buffer.length === 0) {
        console.error('❌ CoinflipGenerator: Encoder returned empty buffer');
        throw new Error('GIF generation failed: empty buffer');
      }
      
      // Validate GIF header
      const header = buffer.slice(0, 6).toString('ascii');
      if (!header.startsWith('GIF')) {
        console.error(`❌ CoinflipGenerator: Invalid GIF header: ${header}`);
        console.error(`   First 20 bytes (hex): ${buffer.slice(0, 20).toString('hex')}`);
        throw new Error(`GIF generation failed: invalid header (${header})`);
      }
      
      console.log(`✅ CoinflipGenerator: Created GIF buffer of ${buffer.length} bytes (header: ${header})`);
      return buffer;
    } catch (error) {
      console.error('❌ CoinflipGenerator: Error getting buffer from encoder:', error);
      throw error;
    }
  }

  /**
   * Draw background
   */
  drawBackground(ctx) {
    // Dark gradient background (like OSRS interface)
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#2c2c2c");
    gradient.addColorStop(0.5, "#1a1a1a");
    gradient.addColorStop(1, "#0d0d0d");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Border
    ctx.strokeStyle = "#3d3d3d";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, this.width - 4, this.height - 4);

    // Inner border (gold trim like OSRS)
    ctx.strokeStyle = "#5C4510";
    ctx.lineWidth = 1;
    ctx.strokeRect(5, 5, this.width - 10, this.height - 10);
  }

  /**
   * Draw player info section (solo mode)
   */
  drawPlayerInfo(ctx, playerName, playerChoice, betAmount) {
    const nameY = 25;

    // Player name
    this.drawName(ctx, playerName, this.width / 2, nameY, "#00ff00");

    // Choice
    ctx.fillStyle = "#aaa";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`Picked: ${playerChoice.toUpperCase()}`, this.width / 2, nameY + 15);

    // Bet amount
    this.drawBet(ctx, betAmount, this.width / 2, nameY + 30);
  }

  /**
   * Draw flip prompt text
   */
  drawFlipPrompt(ctx, text) {
    ctx.fillStyle = "#888";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, this.width / 2, this.height - 15);
  }
}

module.exports = CoinflipGenerator;


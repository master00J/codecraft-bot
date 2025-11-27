const { createCanvas, loadImage } = require("@napi-rs/canvas");
const GIFEncoder = require("gif-encoder-2");
const fs = require("fs");
const path = require("path");

/**
 * Dice Roll GIF Generator for Discord Bot
 * 
 * Generates animated dice roll GIFs with realistic tumbling animation
 * showing different faces as the dice roll
 */

class DiceGifGenerator {
  constructor(options = {}) {
    this.width = options.width || 300;
    this.height = options.height || 180;
    this.frameDelay = options.frameDelay || 70;
    this.background = null;
  }

  /**
   * Load optional custom background
   */
  async loadBackground(imagePath) {
    if (fs.existsSync(imagePath)) {
      try {
        this.background = await loadImage(imagePath);
        console.log(`✅ Loaded dice background`);
        return true;
      } catch (e) {
        console.warn(`⚠️ Failed to load background: ${e.message}`);
      }
    }
    return false;
  }

  /**
   * Draw OSRS Duel Arena style background
   */
  drawBackground(ctx) {
    if (this.background) {
      ctx.drawImage(this.background, 0, 0, this.width, this.height);
      return;
    }

    // Sky gradient (desert sky)
    const skyGradient = ctx.createLinearGradient(0, 0, 0, this.height * 0.4);
    skyGradient.addColorStop(0, "#87CEEB");
    skyGradient.addColorStop(1, "#F4A460");
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, this.width, this.height * 0.4);

    // Desert sand ground
    const groundGradient = ctx.createLinearGradient(0, this.height * 0.35, 0, this.height);
    groundGradient.addColorStop(0, "#DEB887");
    groundGradient.addColorStop(0.3, "#D2B48C");
    groundGradient.addColorStop(1, "#C4A86B");
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, this.height * 0.35, this.width, this.height * 0.65);

    // Arena fence
    ctx.strokeStyle = "#8B4513";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, this.height * 0.38);
    ctx.lineTo(this.width, this.height * 0.38);
    ctx.stroke();

    // Fence posts
    ctx.fillStyle = "#8B4513";
    for (let x = 15; x < this.width; x += 50) {
      ctx.fillRect(x, this.height * 0.32, 6, this.height * 0.1);
    }

    // Rope
    ctx.strokeStyle = "#A0522D";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.height * 0.35);
    for (let x = 0; x < this.width; x += 25) {
      ctx.lineTo(x + 12, this.height * 0.37);
      ctx.lineTo(x + 25, this.height * 0.35);
    }
    ctx.stroke();
  }

  /**
   * Draw dots for a die face
   */
  drawDots(ctx, value, halfSize, dotRadius) {
    ctx.fillStyle = "#1a1a1a";
    const offset = halfSize * 0.5;

    const dotPositions = {
      1: [[0, 0]],
      2: [[-offset, -offset], [offset, offset]],
      3: [[-offset, -offset], [0, 0], [offset, offset]],
      4: [[-offset, -offset], [offset, -offset], [-offset, offset], [offset, offset]],
      5: [[-offset, -offset], [offset, -offset], [0, 0], [-offset, offset], [offset, offset]],
      6: [[-offset, -offset], [offset, -offset], [-offset, 0], [offset, 0], [-offset, offset], [offset, offset]]
    };

    const dots = dotPositions[value] || dotPositions[1];
    for (const [dx, dy] of dots) {
      ctx.beginPath();
      ctx.arc(dx, dy, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draw a 3D-ish die showing a face with perspective
   * @param {number} tiltX - Tilt angle on X axis (-1 to 1, affects which side faces show)
   * @param {number} tiltY - Tilt angle on Y axis (-1 to 1, affects which side faces show)
   */
  drawDie3D(ctx, x, y, size, topFace, tiltX = 0, tiltY = 0, bounce = 0) {
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2 - bounce);

    const halfSize = size / 2;
    const dotRadius = size * 0.07;
    const depth = size * 0.15; // 3D depth

    // Opposite faces on a die always sum to 7
    const oppositeFace = (face) => 7 - face;
    
    // Adjacent faces mapping (what's next to each face)
    const adjacentFaces = {
      1: { right: 3, left: 4, top: 2, bottom: 5 },
      2: { right: 3, left: 4, top: 6, bottom: 1 },
      3: { right: 6, left: 1, top: 2, bottom: 5 },
      4: { right: 1, left: 6, top: 2, bottom: 5 },
      5: { right: 3, left: 4, top: 1, bottom: 6 },
      6: { right: 3, left: 4, top: 5, bottom: 2 }
    };

    const adjacent = adjacentFaces[topFace];

    // Calculate visible side depths based on tilt
    const rightDepth = Math.max(0, tiltX) * depth;
    const leftDepth = Math.max(0, -tiltX) * depth;
    const bottomDepth = Math.max(0, tiltY) * depth;
    const topDepth = Math.max(0, -tiltY) * depth;

    // Draw shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(0, halfSize + 5 + bounce * 0.3, halfSize * 0.8, halfSize * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw right side face (if tilted right)
    if (rightDepth > 2) {
      ctx.fillStyle = "#DDDDDD";
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(halfSize, -halfSize);
      ctx.lineTo(halfSize + rightDepth, -halfSize + rightDepth * 0.5);
      ctx.lineTo(halfSize + rightDepth, halfSize + rightDepth * 0.5);
      ctx.lineTo(halfSize, halfSize);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw dots on right face
      if (rightDepth > depth * 0.5) {
        ctx.save();
        ctx.translate(halfSize + rightDepth * 0.5, rightDepth * 0.25);
        ctx.scale(0.3, 0.8);
        this.drawDots(ctx, adjacent.right, halfSize, dotRadius);
        ctx.restore();
      }
    }

    // Draw left side face (if tilted left)
    if (leftDepth > 2) {
      ctx.fillStyle = "#DDDDDD";
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-halfSize, -halfSize);
      ctx.lineTo(-halfSize - leftDepth, -halfSize + leftDepth * 0.5);
      ctx.lineTo(-halfSize - leftDepth, halfSize + leftDepth * 0.5);
      ctx.lineTo(-halfSize, halfSize);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw dots on left face
      if (leftDepth > depth * 0.5) {
        ctx.save();
        ctx.translate(-halfSize - leftDepth * 0.5, leftDepth * 0.25);
        ctx.scale(0.3, 0.8);
        this.drawDots(ctx, adjacent.left, halfSize, dotRadius);
        ctx.restore();
      }
    }

    // Draw bottom side face (if tilted forward)
    if (bottomDepth > 2) {
      ctx.fillStyle = "#CCCCCC";
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-halfSize, halfSize);
      ctx.lineTo(-halfSize + bottomDepth * 0.5, halfSize + bottomDepth);
      ctx.lineTo(halfSize + bottomDepth * 0.5, halfSize + bottomDepth);
      ctx.lineTo(halfSize, halfSize);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw dots on bottom face
      if (bottomDepth > depth * 0.5) {
        ctx.save();
        ctx.translate(bottomDepth * 0.25, halfSize + bottomDepth * 0.5);
        ctx.scale(0.8, 0.3);
        this.drawDots(ctx, adjacent.bottom, halfSize, dotRadius);
        ctx.restore();
      }
    }

    // Draw main face (top)
    const skewX = tiltX * 0.1;
    const skewY = tiltY * 0.1;
    
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 2;

    // Slightly skewed rectangle for perspective
    ctx.beginPath();
    ctx.moveTo(-halfSize + skewX * halfSize, -halfSize + skewY * halfSize);
    ctx.lineTo(halfSize + skewX * halfSize, -halfSize - skewY * halfSize);
    ctx.lineTo(halfSize - skewX * halfSize, halfSize - skewY * halfSize);
    ctx.lineTo(-halfSize - skewX * halfSize, halfSize + skewY * halfSize);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw dots on main face
    this.drawDots(ctx, topFace, halfSize, dotRadius);

    ctx.restore();
  }

  /**
   * Draw player name
   */
  drawName(ctx, name, x, y, isWinner = false) {
    const displayName = name.length > 12 ? name.substring(0, 11) + '…' : name;

    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.fillStyle = isWinner ? "#FFD700" : "#FFFFFF";
    ctx.strokeText(displayName, x, y);
    ctx.fillText(displayName, x, y);
  }

  /**
   * Generate a realistic roll sequence (which faces show during tumble)
   */
  generateRollSequence(finalValue, numFrames) {
    const sequence = [];
    
    // Define roll patterns - realistic tumble through adjacent faces
    const rollPatterns = {
      1: [3, 6, 4, 1, 3, 6, 4, 1, 2, 1],
      2: [4, 1, 3, 2, 6, 5, 4, 2, 1, 2],
      3: [1, 5, 6, 3, 2, 4, 1, 3, 5, 3],
      4: [2, 6, 5, 4, 1, 3, 2, 4, 6, 4],
      5: [3, 1, 2, 5, 6, 4, 3, 5, 1, 5],
      6: [4, 2, 1, 6, 5, 3, 4, 6, 2, 6]
    };

    const pattern = rollPatterns[finalValue];
    
    for (let i = 0; i < numFrames; i++) {
      const progress = i / numFrames;
      
      // Fast changes at start, slow down at end
      if (progress < 0.7) {
        // During roll - cycle through faces quickly
        const patternIndex = Math.floor((i * 1.5) % pattern.length);
        sequence.push(pattern[patternIndex]);
      } else {
        // Settling - show final value
        sequence.push(finalValue);
      }
    }
    
    return sequence;
  }

  /**
   * Generate dice roll GIF
   */
  async roll(options) {
    const {
      player1 = "Player 1",
      player2 = "Player 2",
      roll1,
      roll2,
      betAmount = null
    } = options;

    // Validate rolls
    const finalRoll1 = Math.max(1, Math.min(6, roll1 || Math.floor(Math.random() * 6) + 1));
    const finalRoll2 = Math.max(1, Math.min(6, roll2 || Math.floor(Math.random() * 6) + 1));

    const encoder = new GIFEncoder(this.width, this.height);
    encoder.setDelay(this.frameDelay);
    encoder.setRepeat(0);
    encoder.setQuality(10);
    encoder.start();

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d");

    const dieSize = 50;
    const die1X = this.width * 0.25 - dieSize / 2;
    const die2X = this.width * 0.75 - dieSize / 2;
    const dieBaseY = this.height * 0.5;

    // Generate roll sequences for both dice
    const rollFrames = 16;
    const sequence1 = this.generateRollSequence(finalRoll1, rollFrames);
    const sequence2 = this.generateRollSequence(finalRoll2, rollFrames);

    // Rolling animation
    for (let i = 0; i < rollFrames; i++) {
      this.drawBackground(ctx);

      const progress = i / rollFrames;
      const settlingProgress = Math.max(0, (progress - 0.6) / 0.4); // 0 until 60%, then ramp to 1
      
      // Bounce height - high at start, settles to 0
      const bounceEnvelope = Math.pow(1 - progress, 1.5);
      const bounce1 = bounceEnvelope * Math.abs(Math.sin(i * 1.2)) * 35;
      const bounce2 = bounceEnvelope * Math.abs(Math.sin(i * 1.4 + 1)) * 35;

      // Tilt values - chaotic at start, settle to 0
      const tiltEnvelope = Math.pow(1 - progress, 2);
      const tilt1X = tiltEnvelope * Math.sin(i * 2.1) * 0.8;
      const tilt1Y = tiltEnvelope * Math.cos(i * 1.8) * 0.6;
      const tilt2X = tiltEnvelope * Math.sin(i * 2.4 + 2) * 0.8;
      const tilt2Y = tiltEnvelope * Math.cos(i * 2.0 + 1) * 0.6;

      // Horizontal wobble during roll
      const wobble1 = tiltEnvelope * Math.sin(i * 3) * 8;
      const wobble2 = tiltEnvelope * Math.sin(i * 3.5 + 1.5) * 8;

      // Get current face value from sequence
      const face1 = sequence1[i];
      const face2 = sequence2[i];

      // Draw dice with 3D effect
      this.drawDie3D(ctx, die1X + wobble1, dieBaseY, dieSize, face1, tilt1X, tilt1Y, bounce1);
      this.drawDie3D(ctx, die2X + wobble2, dieBaseY, dieSize, face2, tilt2X, tilt2Y, bounce2);

      // Draw names
      this.drawName(ctx, player1, this.width * 0.25, 25);
      this.drawName(ctx, player2, this.width * 0.75, 25);

      // Draw bet amount
      if (betAmount) {
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = "#FFD700";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        const betText = `Bet: ${betAmount.toLocaleString()} gp`;
        ctx.strokeText(betText, this.width / 2, this.height - 12);
        ctx.fillText(betText, this.width / 2, this.height - 12);
      }

      encoder.addFrame(ctx.getImageData(0, 0, this.width, this.height).data);
    }

    // Result frames
    const winner = finalRoll1 > finalRoll2 ? 1 : (finalRoll2 > finalRoll1 ? 2 : 0);
    const winnerName = winner === 1 ? player1 : (winner === 2 ? player2 : null);

    for (let i = 0; i < 10; i++) {
      this.drawBackground(ctx);

      // Draw final dice (settled, no tilt)
      this.drawDie3D(ctx, die1X, dieBaseY, dieSize, finalRoll1, 0, 0, 0);
      this.drawDie3D(ctx, die2X, dieBaseY, dieSize, finalRoll2, 0, 0, 0);

      // Draw names (winner highlighted)
      this.drawName(ctx, player1, this.width * 0.25, 25, winner === 1);
      this.drawName(ctx, player2, this.width * 0.75, 25, winner === 2);

      // Draw roll values under dice
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      
      // Winner's number in green, loser in red, tie in white
      ctx.fillStyle = winner === 1 ? "#00FF00" : (winner === 2 ? "#FF4444" : "#FFFFFF");
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.strokeText(finalRoll1.toString(), this.width * 0.25, dieBaseY + dieSize + 25);
      ctx.fillText(finalRoll1.toString(), this.width * 0.25, dieBaseY + dieSize + 25);

      ctx.fillStyle = winner === 2 ? "#00FF00" : (winner === 1 ? "#FF4444" : "#FFFFFF");
      ctx.strokeText(finalRoll2.toString(), this.width * 0.75, dieBaseY + dieSize + 25);
      ctx.fillText(finalRoll2.toString(), this.width * 0.75, dieBaseY + dieSize + 25);

      // Winner/Tie text
      const pulse = 1 + Math.sin(i * 0.6) * 0.08;
      ctx.save();
      ctx.translate(this.width / 2, dieBaseY + 15);
      ctx.scale(pulse, pulse);

      ctx.font = "bold 20px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (winner === 0) {
        ctx.fillStyle = "#FFFF00";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        ctx.strokeText("TIE!", 0, 0);
        ctx.fillText("TIE!", 0, 0);
      } else {
        ctx.fillStyle = "#FFD700";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        const text = `${winnerName} WINS!`;
        ctx.strokeText(text, 0, 0);
        ctx.fillText(text, 0, 0);
      }

      ctx.restore();

      // Draw bet amount
      if (betAmount) {
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = "#FFD700";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        const betText = `Bet: ${betAmount.toLocaleString()} gp`;
        ctx.strokeText(betText, this.width / 2, this.height - 12);
        ctx.fillText(betText, this.width / 2, this.height - 12);
      }

      encoder.addFrame(ctx.getImageData(0, 0, this.width, this.height).data);
    }

    encoder.finish();

    return {
      buffer: encoder.out.getData(),
      roll1: finalRoll1,
      roll2: finalRoll2,
      winner: winner,
      winnerName: winnerName,
      isTie: winner === 0
    };
  }
}

// Test if run directly
if (require.main === module) {
  async function main() {
    const generator = new DiceGifGenerator();

    console.log("Generating dice roll GIF...");
    const result = await generator.roll({
      player1: "jasonn3670",
      player2: "comcraft",
      roll1: 6,
      roll2: 2,
      betAmount: 50000
    });

    fs.writeFileSync("dice-roll.gif", result.buffer);
    console.log(`Saved: dice-roll.gif`);
    console.log(`Result: ${result.roll1} vs ${result.roll2}`);
    console.log(`Winner: ${result.winnerName || "TIE"}`);
  }

  main().catch(console.error);
}

module.exports = DiceGifGenerator;

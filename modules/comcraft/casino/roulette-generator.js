const { createCanvas } = require("@napi-rs/canvas");
const GIFEncoder = require("gif-encoder-2");

/**
 * Roulette Wheel GIF Generator for Discord Bot
 * 
 * Generates animated roulette wheel GIFs with:
 * - Spinning wheel animation
 * - Ball rolling around the wheel
 * - Stops at winning number
 */

class RouletteGenerator {
  constructor(options = {}) {
    this.width = options.width || 400;
    this.height = options.height || 400;
    this.frameDelay = options.frameDelay || 50;
    this.spinFrames = options.spinFrames || 60; // Longer spin for dramatic effect
    this.decelerationFrames = options.decelerationFrames || 30; // Slow down phase
    this.resultFrames = options.resultFrames || 20; // Show result
    
    // European Roulette: 37 numbers (0-36)
    // Color pattern: 0=green, then alternating red/black starting with red for 1
    this.numbers = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
    
    // Number colors: 0=green, odd=red, even=black (except 0)
    this.numberColors = {};
    this.numberColors[0] = 'green';
    for (let i = 1; i <= 36; i++) {
      this.numberColors[i] = (i % 2 === 1) ? 'red' : 'black';
    }
  }

  /**
   * Get color for a number
   */
  getNumberColor(num) {
    return this.numberColors[num] || 'black';
  }

  /**
   * Draw roulette wheel
   */
  drawWheel(ctx, centerX, centerY, radius, rotation = 0) {
    const numCount = this.numbers.length;
    const anglePerNum = (Math.PI * 2) / numCount;
    
    // Draw outer ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#2c1810';
    ctx.fill();
    ctx.strokeStyle = '#1a0f08';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Draw each number segment
    this.numbers.forEach((num, index) => {
      const startAngle = (index * anglePerNum) + rotation;
      const endAngle = ((index + 1) * anglePerNum) + rotation;
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      
      // Color based on number
      const color = this.getNumberColor(num);
      if (color === 'green') {
        ctx.fillStyle = '#0a5d0a';
      } else if (color === 'red') {
        ctx.fillStyle = '#8b0000';
      } else {
        ctx.fillStyle = '#1a1a1a';
      }
      ctx.fill();
      
      // Border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw number in center of segment
      const midAngle = startAngle + anglePerNum / 2;
      const textRadius = radius * 0.7;
      const textX = centerX + Math.cos(midAngle) * textRadius;
      const textY = centerY + Math.sin(midAngle) * textRadius;
      
      ctx.save();
      ctx.translate(textX, textY);
      ctx.rotate(midAngle + Math.PI / 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${radius * 0.08}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(num.toString(), 0, 0);
      ctx.restore();
    });
    
    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#0a5d0a';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw center "0"
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${radius * 0.15}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('0', centerX, centerY);
  }

  /**
   * Draw ball
   */
  drawBall(ctx, centerX, centerY, wheelRadius, ballAngle, frame) {
    const ballRadius = wheelRadius * 0.08;
    const ballDistance = wheelRadius * 0.85;
    
    // Calculate ball position
    const ballX = centerX + Math.cos(ballAngle) * ballDistance;
    const ballY = centerY + Math.sin(ballAngle) * ballDistance;
    
    // Ball shadow
    ctx.beginPath();
    ctx.arc(ballX + 2, ballY + 2, ballRadius * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();
    
    // Ball gradient
    const ballGrad = ctx.createRadialGradient(
      ballX - ballRadius * 0.3,
      ballY - ballRadius * 0.3,
      0,
      ballX,
      ballY,
      ballRadius
    );
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.5, '#ffd700');
    ballGrad.addColorStop(1, '#ff8c00');
    
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();
    ctx.strokeStyle = '#cc7700';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Ball shine
    ctx.beginPath();
    ctx.arc(ballX - ballRadius * 0.3, ballY - ballRadius * 0.3, ballRadius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
  }

  /**
   * Draw pointer/indicator
   */
  drawPointer(ctx, centerX, centerY, wheelRadius) {
    const pointerLength = wheelRadius * 0.15;
    const pointerWidth = wheelRadius * 0.08;
    
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - wheelRadius - pointerLength);
    ctx.lineTo(centerX - pointerWidth / 2, centerY - wheelRadius);
    ctx.lineTo(centerX + pointerWidth / 2, centerY - wheelRadius);
    ctx.closePath();
    
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.strokeStyle = '#cc9900';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * Draw background
   */
  drawBackground(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#1a0a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f0f23');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Generate roulette spin GIF
   */
  async spin(options) {
    const {
      winningNumber = null,
      betAmount = null,
      betType = null,
      playerName = 'Player'
    } = options;

    // Determine winning number if not provided
    const finalNumber = winningNumber !== null && winningNumber !== undefined 
      ? winningNumber 
      : this.numbers[Math.floor(Math.random() * this.numbers.length)];

    const encoder = new GIFEncoder(this.width, this.height);
    encoder.setDelay(this.frameDelay);
    encoder.setRepeat(0);
    encoder.setQuality(10);
    encoder.start();

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d");

    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const wheelRadius = Math.min(this.width, this.height) * 0.4;

    const totalFrames = this.spinFrames + this.decelerationFrames + this.resultFrames;
    
    // Find index of winning number in wheel
    const winningIndex = this.numbers.indexOf(finalNumber);
    const anglePerNum = (Math.PI * 2) / this.numbers.length;
    const targetWheelRotation = -(winningIndex * anglePerNum) - (anglePerNum / 2) + (Math.PI / 2); // Point to top
    const targetBallAngle = 0; // Ball should be at top (pointer position) when wheel stops

    // Animation phases
    let wheelRotation = 0;
    let ballAngle = 0;
    let wheelSpeed = 0.4; // radians per frame - wheel rotation
    let ballSpeed = 0.6; // radians per frame - ball moves faster than wheel initially

    for (let frame = 0; frame < totalFrames; frame++) {
      this.drawBackground(ctx);

      // Phase 1: Fast spin
      if (frame < this.spinFrames) {
        wheelSpeed = 0.4;
        ballSpeed = 0.6; // Ball moves faster than wheel
      }
      // Phase 2: Deceleration
      else if (frame < this.spinFrames + this.decelerationFrames) {
        const decelProgress = (frame - this.spinFrames) / this.decelerationFrames;
        const decelFactor = 1 - decelProgress;
        wheelSpeed = 0.4 * decelFactor;
        ballSpeed = 0.6 * decelFactor; // Both slow down
      }
      // Phase 3: Stop at target
      else {
        wheelSpeed = 0;
        ballSpeed = 0;
        // Snap to final position
        wheelRotation = targetWheelRotation;
        ballAngle = targetBallAngle; // Ball at top (pointer position)
      }

      // Update rotations
      wheelRotation += wheelSpeed;
      ballAngle += ballSpeed;
      
      // Normalize angles to prevent overflow
      wheelRotation = wheelRotation % (Math.PI * 2);
      ballAngle = ballAngle % (Math.PI * 2);

      // Draw wheel (rotates independently)
      this.drawWheel(ctx, centerX, centerY, wheelRadius, wheelRotation);

      // Draw pointer (fixed at top)
      this.drawPointer(ctx, centerX, centerY, wheelRadius);

      // Draw ball (relative to wheel rotation - ball moves around the wheel)
      // Ball angle is relative to the wheel, so we need to combine wheel rotation with ball position
      const ballPositionOnWheel = ballAngle - wheelRotation;
      this.drawBall(ctx, centerX, centerY, wheelRadius, ballPositionOnWheel, frame);

      // Draw info text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      
      if (frame < this.spinFrames + this.decelerationFrames) {
        ctx.fillText('Spinning...', centerX, this.height - 30);
      } else {
        ctx.fillStyle = this.getNumberColor(finalNumber) === 'red' ? '#ff6b6b' : 
                       this.getNumberColor(finalNumber) === 'green' ? '#51cf66' : '#ffffff';
        ctx.fillText(`Winning Number: ${finalNumber}`, centerX, this.height - 30);
      }

      // Add frame to GIF
      encoder.addFrame(ctx.getImageData(0, 0, this.width, this.height).data);
    }

    encoder.finish();

    return {
      buffer: encoder.out.getData(),
      winningNumber: finalNumber,
    };
  }
}

module.exports = RouletteGenerator;

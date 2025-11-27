const { createCanvas, loadImage } = require("@napi-rs/canvas");
const GIFEncoder = require("gif-encoder-2");
const fs = require("fs");
const path = require("path");

/**
 * Duel GIF Generator for Discord Bot
 *
 * Generates animated battle GIFs with:
 * - Two fighters with idle animations
 * - Dynamic HP bars
 * - Hit splats on damage
 * - Attack animations
 */

class DuelGifGenerator {
  constructor(options = {}) {
    // Canvas settings - larger for better quality
    this.width = options.width || 400;
    this.height = options.height || 220;

    // Frame settings
    this.frameWidth = options.frameWidth || 200;
    this.frameHeight = options.frameHeight || 200;

    // Animation settings - slower for smoother hits
    this.frameDelay = options.frameDelay || 120; // ms per frame (langzamer voor betere zichtbaarheid)

    // Sprite sheets (will be loaded)
    this.sprites = {};
    
    // Background image (optional)
    this.backgroundImage = null;
    
    // Track if sprites are loaded
    this.spritesLoaded = false;
  }

  /**
   * Load all sprite sheets
   */
  async loadSprites(spritePath) {
    // Try multiple filename variations for each sprite
    const spriteFiles = {
      idle: ["Idle.png", "idle.png"],
      attack1: ["Attack1.png", "attack1.png"],
      attack2: ["Attack2.png", "attack2.png"],
      takeHit: ["Take_Hit.png", "Take Hit.png", "take_hit.png", "TakeHit.png"],
      death: ["Death.png", "death.png"],
    };

    let loadedCount = 0;
    
    for (const [key, filenames] of Object.entries(spriteFiles)) {
      let loaded = false;
      
      for (const filename of filenames) {
      const filePath = path.join(spritePath, filename);
      if (fs.existsSync(filePath)) {
          try {
        this.sprites[key] = await loadImage(filePath);
            console.log(`✅ Loaded sprite: ${filename} (${this.sprites[key].width}x${this.sprites[key].height})`);
            loadedCount++;
            loaded = true;
            break; // Stop trying other filenames
          } catch (error) {
            console.error(`❌ Failed to load sprite ${filename}:`, error.message);
          }
        }
      }
      
      if (!loaded) {
        console.warn(`⚠️ Sprite "${key}" not found (tried: ${filenames.join(', ')})`);
      }
    }
    
    // Load background image
    const bgFiles = ["background duel.png", "background_duel.png", "background.png", "bg.png"];
    for (const bgFile of bgFiles) {
      const bgPath = path.join(spritePath, bgFile);
      if (fs.existsSync(bgPath)) {
        try {
          this.backgroundImage = await loadImage(bgPath);
          console.log(`✅ Loaded background: ${bgFile} (${this.backgroundImage.width}x${this.backgroundImage.height})`);
          break;
        } catch (error) {
          console.error(`❌ Failed to load background ${bgFile}:`, error.message);
        }
      }
    }
    
    if (!this.backgroundImage) {
      console.warn('⚠️ No background image found, using solid color');
    }
    
    console.log(`📊 Loaded ${loadedCount}/${Object.keys(spriteFiles).length} sprites`);
    
    // Check if essential sprites are loaded
    if (!this.sprites.idle) {
      throw new Error('Essential sprite "Idle.png" not found!');
    }
    
    // Use idle as fallback for missing sprites
    if (!this.sprites.attack1) {
      console.warn('⚠️ Using Idle as fallback for Attack1');
      this.sprites.attack1 = this.sprites.idle;
    }
    if (!this.sprites.attack2) {
      console.warn('⚠️ Using Attack1 as fallback for Attack2');
      this.sprites.attack2 = this.sprites.attack1;
    }
    if (!this.sprites.takeHit) {
      console.warn('⚠️ Using Idle as fallback for TakeHit');
      this.sprites.takeHit = this.sprites.idle;
    }
    if (!this.sprites.death) {
      console.warn('⚠️ Using TakeHit as fallback for Death');
      this.sprites.death = this.sprites.takeHit;
    }
    
    this.spritesLoaded = true;
    return loadedCount > 0;
  }

  /**
   * Check if sprites are loaded
   */
  isReady() {
    return this.spritesLoaded && this.sprites.idle;
  }

  /**
   * Get frame count for a sprite sheet
   */
  getFrameCount(spriteSheet) {
    // Assuming square frames, calculate based on aspect ratio
    const aspectRatio = spriteSheet.width / spriteSheet.height;
    return Math.round(aspectRatio);
  }

  /**
   * Extract a single frame from a sprite sheet
   */
  getFrame(spriteSheet, frameIndex, totalFrames = null) {
    if (!totalFrames) {
      totalFrames = this.getFrameCount(spriteSheet);
    }
    
    const frameW = spriteSheet.width / totalFrames;
    const frameH = spriteSheet.height;
    // Clamp frameIndex to valid range
    frameIndex = Math.max(0, Math.min(frameIndex, totalFrames - 1));
    return {
      image: spriteSheet,
      sx: frameIndex * frameW,
      sy: 0,
      sw: frameW,
      sh: frameH,
    };
  }

  /**
   * Draw a character on the canvas
   */
  drawCharacter(ctx, frame, x, y, scale = 0.5, flipped = false) {
    ctx.save();
    if (flipped) {
      ctx.translate(x + frame.sw * scale, y);
      ctx.scale(-1, 1);
      ctx.drawImage(
        frame.image,
        frame.sx,
        frame.sy,
        frame.sw,
        frame.sh,
        0,
        0,
        frame.sw * scale,
        frame.sh * scale
      );
    } else {
      ctx.drawImage(
        frame.image,
        frame.sx,
        frame.sy,
        frame.sw,
        frame.sh,
        x,
        y,
        frame.sw * scale,
        frame.sh * scale
      );
    }
    ctx.restore();
  }

  /**
   * Draw background
   */
  drawBackground(ctx) {
    if (this.backgroundImage) {
      // Draw the background image, scaled to fit the canvas
      ctx.drawImage(this.backgroundImage, 0, 0, this.width, this.height);
    } else {
      // Fallback: Green battle background
      ctx.fillStyle = "#2d5a3d";
      ctx.fillRect(0, 0, this.width, this.height);
      // Draw grass pattern (static, no random)
      ctx.fillStyle = "#3d6b4a";
      for (let gx = 0; gx < this.width; gx += 15) {
        for (let gy = this.height - 25; gy < this.height; gy += 8) {
          ctx.fillRect(gx + (gy % 2) * 5, gy, 2, 4);
        }
      }
    }
  }

  /**
   * Draw HP bar
   */
  drawHpBar(ctx, x, y, currentHp, maxHp, width = 80, height = 14) {
    const percentage = Math.max(0, Math.min(1, currentHp / maxHp));
    // Background (dark)
    ctx.fillStyle = "#1a0000";
    ctx.fillRect(x, y, width, height);
    // HP fill
    if (percentage > 0.5) {
      ctx.fillStyle = "#00cc00"; // Green
    } else if (percentage > 0.25) {
      ctx.fillStyle = "#ff9900"; // Orange
    } else {
      ctx.fillStyle = "#cc0000"; // Red
    }

    const fillWidth = Math.max(0, (width - 4) * percentage);
    ctx.fillRect(x + 2, y + 2, fillWidth, height - 4);
    // Border
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    // HP text
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.max(0, currentHp)}/${maxHp}`, x + width / 2, y + height / 2);
  }

  /**
   * Draw hit splat (OSRS style)
   */
  drawHitSplat(ctx, x, y, damage, type = "damage") {
    const radius = 14;
    // Splat background
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (type === "damage" || damage > 0) {
      ctx.fillStyle = "#cc0000"; // Red for damage
    } else {
      ctx.fillStyle = "#0066cc"; // Blue for miss/block
    }
    ctx.fill();
    // Border
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Damage number
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(damage.toString(), x, y);
  }

  /**
   * Draw player name
   */
  drawName(ctx, name, x, y) {
    // Truncate long names
    const displayName = name.length > 12 ? name.substring(0, 11) + '…' : name;
    
    ctx.fillStyle = "#ffff00";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.strokeText(displayName, x, y);
    ctx.fillText(displayName, x, y);
  }

  /**
   * Generate a LIVE duel GIF showing only the LAST hit
   * This keeps the GIF small and fast to generate
   *
   * @param {Object} battleData
   * @param {Object} battleData.player1 - { name, maxHp }
   * @param {Object} battleData.player2 - { name, maxHp }
   * @param {Object} battleData.lastRound - { attacker: 1|2, damage, p1Hp, p2Hp }
   * @param {boolean} battleData.isFinal - Is this the final hit?
   * @param {number} battleData.winner - 1 or 2 (only if isFinal)
   */
  /**
   * Generate a round GIF showing BOTH hits (turn-based like OSRS)
   * First one player attacks, then the other
   * 
   * @param {Object} battleData
   * @param {Object} battleData.player1 - { name, maxHp }
   * @param {Object} battleData.player2 - { name, maxHp }
   * @param {Object} battleData.p1Attack - { damage, isMiss } - Player 1's attack
   * @param {Object} battleData.p2Attack - { damage, isMiss } - Player 2's attack
   * @param {number} battleData.p1HpAfter - P1 HP after both attacks
   * @param {number} battleData.p2HpAfter - P2 HP after both attacks
   * @param {number} battleData.firstAttacker - 1 or 2 (random who goes first)
   * @param {boolean} battleData.isFinal - Is this the final round?
   * @param {number} battleData.winner - 1 or 2 (only if isFinal)
   */
  async generateLiveHitGif(battleData) {
    const {
      player1,
      player2,
      p1Attack = { damage: 0, isMiss: true },
      p2Attack = { damage: 0, isMiss: true },
      p1HpAfter,
      p2HpAfter,
      firstAttacker = 1,
      isFinal = false, 
      winner = null 
    } = battleData;

    // Fallback voor oude API (lastRound)
    if (battleData.lastRound) {
      const { attacker, damage, p1Hp, p2Hp } = battleData.lastRound;
      return this._generateSingleHitGif({
        player1, player2, attacker, damage, p1Hp, p2Hp, isFinal, winner
      });
    }

    if (!this.isReady()) {
      throw new Error("Sprites not loaded!");
    }

    const encoder = new GIFEncoder(this.width, this.height);
    encoder.setDelay(this.frameDelay);
    encoder.setRepeat(0); // Loop
    encoder.setQuality(10);
    encoder.start();

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d");

    // Get frame counts
    const idleFrames = this.getFrameCount(this.sprites.idle);
    const attackFrames = this.getFrameCount(this.sprites.attack1);
    const hitFrames = this.getFrameCount(this.sprites.takeHit);
    const deathFrames = this.getFrameCount(this.sprites.death);

    // Get actual sprite dimensions
    const idleFrame = this.getFrame(this.sprites.idle, 0, idleFrames);
    const actualSpriteWidth = idleFrame.sw;
    const actualSpriteHeight = idleFrame.sh;

    // Scale and positioning - sprites OVERLAPPING for combat
    const scale = 1.4; // Groter voor betere zichtbaarheid
    const scaledWidth = actualSpriteWidth * scale;
    const scaledHeight = actualSpriteHeight * scale;
    const spacing = -120; // Meer overlap - dichter bij elkaar
    
    const totalWidth = (scaledWidth * 2) + spacing;
    const startX = (this.width - totalWidth) / 2;
    
    const p1X = startX;
    const p2X = startX + scaledWidth + spacing;
    const charY = this.height - scaledHeight; // Op de grond (geen zweven)

    const p1Center = p1X + scaledWidth / 2;
    const p2Center = p2X + scaledWidth / 2;

    // Track HP through the animation
    let currentP1Hp = player1.maxHp;
    let currentP2Hp = player2.maxHp;

    // Calculate starting HP (before this round's attacks)
    if (p1HpAfter !== undefined && p2HpAfter !== undefined) {
      currentP1Hp = p1HpAfter + (p2Attack.isMiss ? 0 : p2Attack.damage);
      currentP2Hp = p2HpAfter + (p1Attack.isMiss ? 0 : p1Attack.damage);
    }

    // Determine attack order
    const attacks = firstAttacker === 1 
      ? [{ attacker: 1, ...p1Attack }, { attacker: 2, ...p2Attack }]
      : [{ attacker: 2, ...p2Attack }, { attacker: 1, ...p1Attack }];

    // Helper to draw a frame
    const drawFrame = (p1Frame, p2Frame, showSplat = null, splatDamage = 0) => {
      this.drawBackground(ctx);
      this.drawCharacter(ctx, p1Frame, p1X, charY, scale, false);
      this.drawCharacter(ctx, p2Frame, p2X, charY, scale, true);
      
      // Draw hit splat
      if (showSplat === 1) {
        this.drawHitSplat(ctx, p1Center, charY + scaledHeight * 0.4, splatDamage);
      } else if (showSplat === 2) {
        this.drawHitSplat(ctx, p2Center, charY + scaledHeight * 0.4, splatDamage);
      }
      
      this.drawName(ctx, player1.name, p1Center, 15);
      this.drawName(ctx, player2.name, p2Center, 15);
      this.drawHpBar(ctx, p1Center - 40, 28, Math.max(0, currentP1Hp), player1.maxHp);
      this.drawHpBar(ctx, p2Center - 40, 28, Math.max(0, currentP2Hp), player2.maxHp);
      
      encoder.addFrame(ctx.getImageData(0, 0, this.width, this.height).data);
    };

    // ====== START MET IDLE FRAME (zelfde als einde voor naadloze loop) ======
    const startIdleFrame = this.getFrame(this.sprites.idle, 0, idleFrames);
    drawFrame(startIdleFrame, startIdleFrame);

    // Process each attack in order
    for (const attack of attacks) {
      const { attacker, damage, isMiss } = attack;
      const actualDamage = isMiss ? 0 : (damage || 0);

      // Attack animation (6 frames voor langzamere hits)
      for (let i = 0; i < 6; i++) {
        const progress = i / 5;
        const attackFrameIdx = Math.floor(progress * (attackFrames - 1));
        const hitFrameIdx = Math.floor(progress * (hitFrames - 1));
        const showSplat = progress >= 0.6;

        let p1Frame, p2Frame;
        let splatTarget = null;
        let splatDamage = actualDamage;

        if (attacker === 1) {
          // Player 1 attacks Player 2
          p1Frame = this.getFrame(this.sprites.attack1, attackFrameIdx, attackFrames);
          p2Frame = (showSplat && actualDamage > 0)
            ? this.getFrame(this.sprites.takeHit, hitFrameIdx, hitFrames)
            : this.getFrame(this.sprites.idle, 0, idleFrames);
          
          if (showSplat) {
            splatTarget = 2;
            // Apply damage to P2 (op frame 3 van 6)
            if (i === 3) currentP2Hp = Math.max(0, currentP2Hp - actualDamage);
          }
        } else {
          // Player 2 attacks Player 1
          p2Frame = this.getFrame(this.sprites.attack1, attackFrameIdx, attackFrames);
          p1Frame = (showSplat && actualDamage > 0)
            ? this.getFrame(this.sprites.takeHit, hitFrameIdx, hitFrames)
            : this.getFrame(this.sprites.idle, 0, idleFrames);
          
          if (showSplat) {
            splatTarget = 1;
            // Apply damage to P1 (op frame 3 van 6)
            if (i === 3) currentP1Hp = Math.max(0, currentP1Hp - actualDamage);
          }
        }

        drawFrame(p1Frame, p2Frame, showSplat ? splatTarget : null, splatDamage);
      }

      // Brief idle pause between attacks (1 frame)
      const idleF = this.getFrame(this.sprites.idle, 0, idleFrames);
      drawFrame(idleF, idleF);
    }

    // ====== EINDE: Lange idle pauze (zelfde frame als begin voor naadloze loop) ======
    const endIdleFrame = this.getFrame(this.sprites.idle, 0, idleFrames);
    
    if (isFinal && winner) {
      // Winner celebration - langere dood animatie voor betere zichtbaarheid
      for (let i = 0; i < 12; i++) {
        const idleAnim = this.getFrame(this.sprites.idle, i % idleFrames, idleFrames);
        const deathProgress = Math.min(i / 11, 1); // 0 tot 1 over 12 frames
        const deathFrameIdx = Math.floor(deathProgress * (deathFrames - 1));
        const deathF = this.getFrame(this.sprites.death, deathFrameIdx, deathFrames);

        this.drawBackground(ctx);
        if (winner === 1) {
          this.drawCharacter(ctx, idleAnim, p1X, charY, scale, false);
          this.drawCharacter(ctx, deathF, p2X, charY, scale, true);
        } else {
          this.drawCharacter(ctx, deathF, p1X, charY, scale, false);
          this.drawCharacter(ctx, idleAnim, p2X, charY, scale, true);
        }

        this.drawName(ctx, player1.name, p1Center, 15);
        this.drawName(ctx, player2.name, p2Center, 15);
        this.drawHpBar(ctx, p1Center - 40, 28, Math.max(0, currentP1Hp), player1.maxHp);
        this.drawHpBar(ctx, p2Center - 40, 28, Math.max(0, currentP2Hp), player2.maxHp);

        // Winner text
        const winnerName = winner === 1 ? player1.name : player2.name;
        ctx.fillStyle = "#ffd700";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        ctx.strokeText(`${winnerName} WINS!`, this.width / 2, this.height / 2 - 10);
        ctx.fillText(`${winnerName} WINS!`, this.width / 2, this.height / 2 - 10);

        // Langere delay voor dood animatie frames (laatste 6 frames extra lang)
        if (i >= 6) {
          encoder.setDelay(200); // 200ms voor laatste frames
        } else {
          encoder.setDelay(this.frameDelay); // Normale delay voor eerste frames
        }
        encoder.addFrame(ctx.getImageData(0, 0, this.width, this.height).data);
      }
    } else {
      // Lange statische idle pauze met hetzelfde frame als het begin
      // Dit zorgt voor naadloze loop: einde -> begin is identiek
      encoder.setDelay(1500); // 1.5 seconde wachten
      drawFrame(endIdleFrame, endIdleFrame);
    }

    encoder.finish();
    return encoder.out.getData();
  }

  /**
   * Fallback for old single-hit API
   */
  async _generateSingleHitGif({ player1, player2, attacker, damage, p1Hp, p2Hp, isFinal, winner }) {
    // Convert to new format
    const p1Attack = attacker === 1 ? { damage, isMiss: damage === 0 } : { damage: 0, isMiss: true };
    const p2Attack = attacker === 2 ? { damage, isMiss: damage === 0 } : { damage: 0, isMiss: true };
    
    return this.generateLiveHitGif({
      player1,
      player2,
      p1Attack,
      p2Attack,
      p1HpAfter: p1Hp,
      p2HpAfter: p2Hp,
      firstAttacker: attacker,
      isFinal,
      winner
    });
  }

  /**
   * Generate full battle recap GIF (for final result)
   * Shows all rounds
   */
  async generateFullBattleGif(battleData) {
    const { player1, player2, rounds, winner } = battleData;

    if (!this.isReady()) throw new Error("Sprites not loaded!");
    if (!rounds || rounds.length === 0) throw new Error("No rounds provided");

    const encoder = new GIFEncoder(this.width, this.height);
    encoder.setDelay(this.frameDelay);
    encoder.setRepeat(0); // Loop oneindig - smooth
    encoder.setQuality(10);
    encoder.start();

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d");

    // Get frame counts
    const idleFrames = this.getFrameCount(this.sprites.idle);
    const attackFrames = this.getFrameCount(this.sprites.attack1);
    const hitFrames = this.getFrameCount(this.sprites.takeHit);
    const deathFrames = this.getFrameCount(this.sprites.death);

    // Get actual sprite dimensions
    const idleFrame = this.getFrame(this.sprites.idle, 0, idleFrames);
    const actualSpriteWidth = idleFrame.sw;
    const actualSpriteHeight = idleFrame.sh;

    // Scale and positioning - sprites OVERLAPPING for combat
    const scale = 1.4; // Groter voor betere zichtbaarheid
    const scaledWidth = actualSpriteWidth * scale;
    const scaledHeight = actualSpriteHeight * scale;
    const spacing = -120; // Meer overlap - dichter bij elkaar
    
    const totalWidth = (scaledWidth * 2) + spacing;
    const startX = (this.width - totalWidth) / 2;
    
    const p1X = startX;
    const p2X = startX + scaledWidth + spacing;
    const charY = this.height - scaledHeight; // Op de grond (geen zweven)

    const p1Center = p1X + scaledWidth / 2;
    const p2Center = p2X + scaledWidth / 2;

    // Track HP through the battle
    let currentP1Hp = player1.maxHp;
    let currentP2Hp = player2.maxHp;

    // Show ALL rounds (no limit for full battle)
    const maxRounds = rounds.length;

    // Generate frames for each round
    for (let roundIndex = 0; roundIndex < maxRounds; roundIndex++) {
      const round = rounds[roundIndex];
      const { attacker, damage, p1Hp, p2Hp } = round;

      // Phase 1: Brief idle (1 frame)
      this.drawBackground(ctx);
      const idleFrame1 = this.getFrame(this.sprites.idle, roundIndex % idleFrames, idleFrames);
      this.drawCharacter(ctx, idleFrame1, p1X, charY, scale, false);
      this.drawCharacter(ctx, idleFrame1, p2X, charY, scale, true);
      this.drawName(ctx, player1.name, p1Center, 15);
      this.drawName(ctx, player2.name, p2Center, 15);
      this.drawHpBar(ctx, p1Center - 40, 25, currentP1Hp, player1.maxHp);
      this.drawHpBar(ctx, p2Center - 40, 25, currentP2Hp, player2.maxHp);
      encoder.addFrame(ctx.getImageData(0, 0, this.width, this.height).data);

      // Phase 2: Attack animation (6 frames voor langzamere hits)
      for (let i = 0; i < 6; i++) {
        this.drawBackground(ctx);

        const progress = i / 5;
        const attackFrameIdx = Math.floor(progress * (attackFrames - 1));
        const hitFrameIdx = Math.floor(progress * (hitFrames - 1));
        const showSplat = progress >= 0.5;

        // Update HP when splat shows
        if (showSplat) {
          currentP1Hp = Math.max(0, p1Hp);
          currentP2Hp = Math.max(0, p2Hp);
        }

        if (attacker === 1) {
          const attackFrame = this.getFrame(this.sprites.attack1, attackFrameIdx, attackFrames);
          const defenderFrame = showSplat && damage > 0
            ? this.getFrame(this.sprites.takeHit, hitFrameIdx, hitFrames)
            : this.getFrame(this.sprites.idle, 0, idleFrames);

          this.drawCharacter(ctx, attackFrame, p1X, charY, scale, false);
          this.drawCharacter(ctx, defenderFrame, p2X, charY, scale, true);

          if (showSplat && damage > 0) {
            this.drawHitSplat(ctx, p2Center, charY + scaledHeight * 0.4, damage);
          }
        } else {
          const defenderFrame = showSplat && damage > 0
            ? this.getFrame(this.sprites.takeHit, hitFrameIdx, hitFrames)
            : this.getFrame(this.sprites.idle, 0, idleFrames);
          const attackFrame = this.getFrame(this.sprites.attack1, attackFrameIdx, attackFrames);

          this.drawCharacter(ctx, defenderFrame, p1X, charY, scale, false);
          this.drawCharacter(ctx, attackFrame, p2X, charY, scale, true);

          if (showSplat && damage > 0) {
            this.drawHitSplat(ctx, p1Center, charY + scaledHeight * 0.4, damage);
          }
        }

        this.drawName(ctx, player1.name, p1Center, 15);
        this.drawName(ctx, player2.name, p2Center, 15);
        this.drawHpBar(ctx, p1Center - 40, 25, currentP1Hp, player1.maxHp);
        this.drawHpBar(ctx, p2Center - 40, 25, currentP2Hp, player2.maxHp);
        encoder.addFrame(ctx.getImageData(0, 0, this.width, this.height).data);
      }
    }

    // Final frames: Winner celebration - langere dood animatie voor betere zichtbaarheid
    for (let i = 0; i < 12; i++) {
      this.drawBackground(ctx);

      const idleFrameIdx = i % idleFrames;
      const deathProgress = Math.min(i / 11, 1); // 0 tot 1 over 12 frames
      const deathFrameIdx = Math.floor(deathProgress * (deathFrames - 1));

      if (winner === 1) {
        const winnerFrame = this.getFrame(this.sprites.idle, idleFrameIdx, idleFrames);
        const loserFrame = this.getFrame(this.sprites.death, deathFrameIdx, deathFrames);
        this.drawCharacter(ctx, winnerFrame, p1X, charY, scale, false);
        this.drawCharacter(ctx, loserFrame, p2X, charY, scale, true);
      } else {
        const loserFrame = this.getFrame(this.sprites.death, deathFrameIdx, deathFrames);
        const winnerFrame = this.getFrame(this.sprites.idle, idleFrameIdx, idleFrames);
        this.drawCharacter(ctx, loserFrame, p1X, charY, scale, false);
        this.drawCharacter(ctx, winnerFrame, p2X, charY, scale, true);
      }

      this.drawName(ctx, player1.name, p1Center, 15);
      this.drawName(ctx, player2.name, p2Center, 15);
      this.drawHpBar(ctx, p1Center - 40, 25, currentP1Hp, player1.maxHp);
      this.drawHpBar(ctx, p2Center - 40, 25, currentP2Hp, player2.maxHp);

      // Winner text (with pulsing effect)
      const winnerName = winner === 1 ? player1.name : player2.name;
      const pulse = 1 + Math.sin(i * 0.8) * 0.1;
      
      ctx.save();
      ctx.translate(this.width / 2, this.height / 2 - 10);
      ctx.scale(pulse, pulse);
      
      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 20px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 4;
      ctx.strokeText(`${winnerName} WINS!`, 0, 0);
      ctx.fillText(`${winnerName} WINS!`, 0, 0);
      
      ctx.restore();

      // Langere delay voor dood animatie frames (laatste 6 frames extra lang)
      if (i >= 6) {
        encoder.setDelay(200); // 200ms voor laatste frames
      } else {
        encoder.setDelay(this.frameDelay); // Normale delay voor eerste frames
      }
      encoder.addFrame(ctx.getImageData(0, 0, this.width, this.height).data);
    }

    encoder.finish();
    return encoder.out.getData();
  }

  // Keep old method for backwards compatibility
  async generateDuelGif(battleData, showWinner = true) {
    return this.generateFullBattleGif(battleData);
  }

  /**
   * Simulate a battle and generate GIF (for testing)
   */
  async simulateBattle(player1Name, player2Name, maxHp = 99) {
    const player1 = { name: player1Name, maxHp, hp: maxHp };
    const player2 = { name: player2Name, maxHp, hp: maxHp };

    const rounds = [];
    let currentAttacker = 1;

    // Simulate combat rounds
    while (player1.hp > 0 && player2.hp > 0) {
      const damage = Math.floor(Math.random() * 20) + 1;
      const isMiss = Math.random() < 0.1;

      if (currentAttacker === 1) {
        if (!isMiss) player2.hp = Math.max(0, player2.hp - damage);
        rounds.push({
          attacker: 1,
          damage: isMiss ? 0 : damage,
          p1Hp: player1.hp,
          p2Hp: player2.hp,
        });
      } else {
        if (!isMiss) player1.hp = Math.max(0, player1.hp - damage);
        rounds.push({
          attacker: 2,
          damage: isMiss ? 0 : damage,
          p1Hp: player1.hp,
          p2Hp: player2.hp,
        });
      }

      currentAttacker = currentAttacker === 1 ? 2 : 1;

      // Limit rounds
      if (rounds.length >= 10) break;
    }

    const winner = player1.hp > 0 ? 1 : 2;

    return this.generateFullBattleGif({
      player1: { name: player1Name, maxHp },
      player2: { name: player2Name, maxHp },
      rounds,
      winner,
    });
  }
}

// Test if run directly
if (require.main === module) {
async function main() {
  const generator = new DuelGifGenerator({
    width: 400,
    height: 180,
      frameDelay: 100,
  });

  await generator.loadSprites("./sprites");

    console.log("Generating test duel GIF...");
  const gifBuffer = await generator.simulateBattle("jasonn3670", "comcraft", 99);

  fs.writeFileSync("duel-output.gif", gifBuffer);
  console.log("Saved: duel-output.gif");
}

main().catch(console.error);
}

module.exports = DuelGifGenerator;


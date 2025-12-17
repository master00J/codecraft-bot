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

    // Animation settings - gebalanceerd voor langere duels zonder te grote GIF
    this.frameDelay = options.frameDelay || 100; // ms per frame (was 150, nu 100 voor betere balans)

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
   * Load a separate sprite pack for a specific character folder
   * Returns { sprites, backgroundImage } without modifying this.sprites
   */
  async loadSpritePack(spritePath) {
    const spriteFiles = {
      idle: ["Idle.png", "idle.png", "IDLE.png"],
      attack1: ["Attack1.png", "attack1.png", "Attack.png", "attack.png", "ATTACK.png"],
      attack2: ["Attack2.png", "attack2.png", "ATTACK.png"],
      takeHit: ["Take_Hit.png", "Take Hit.png", "take_hit.png", "TakeHit.png", "Hurt.png", "hurt.png", "HURT.png"],
      death: ["Death.png", "death.png", "Die.png", "die.png", "DEATH.png"],
    };

    const sprites = {};
    let loadedCount = 0;

    for (const [key, filenames] of Object.entries(spriteFiles)) {
      for (const filename of filenames) {
        const filePath = path.join(spritePath, filename);
        if (fs.existsSync(filePath)) {
          try {
            sprites[key] = await loadImage(filePath);
            loadedCount++;
            break;
          } catch (error) {
            console.error(`Failed to load sprite pack ${filename}:`, error.message);
          }
        }
      }
    }

    // Load background
    let backgroundImage = null;
    const bgFiles = ["background duel.png", "background_duel.png", "background.png", "bg.png", "Background.png"];
    for (const bgFile of bgFiles) {
      const bgPath = path.join(spritePath, bgFile);
      if (fs.existsSync(bgPath)) {
        try {
          backgroundImage = await loadImage(bgPath);
          break;
        } catch (e) {}
      }
    }

    // Essential: must have idle
    if (!sprites.idle) {
      throw new Error(`Essential sprite "Idle.png" not found in ${spritePath}`);
    }

    // Fallbacks
    if (!sprites.attack1) sprites.attack1 = sprites.idle;
    if (!sprites.attack2) sprites.attack2 = sprites.attack1;
    if (!sprites.takeHit) sprites.takeHit = sprites.idle;
    if (!sprites.death) sprites.death = sprites.takeHit;

    return { sprites, backgroundImage };
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
  async generateLiveHitGif(battleData, spritePacks = null) {
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

    // Determine sprites to use
    const p1Sprites = spritePacks?.p1 || this.sprites;
    const p2Sprites = spritePacks?.p2 || this.sprites;
    const backgroundOverride = spritePacks?.backgroundImage || null;

    const encoder = new GIFEncoder(this.width, this.height);
    encoder.setDelay(this.frameDelay);
    encoder.setRepeat(-1); // Geen loop - stopt aan het einde
    encoder.setQuality(10);
    encoder.start();

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d");

    // Get frame counts
    const idleFramesP1 = this.getFrameCount(p1Sprites.idle);
    const idleFramesP2 = this.getFrameCount(p2Sprites.idle);
    const attackFramesP1 = this.getFrameCount(p1Sprites.attack1);
    const attackFramesP2 = this.getFrameCount(p2Sprites.attack1);
    const hitFramesP1 = this.getFrameCount(p1Sprites.takeHit);
    const hitFramesP2 = this.getFrameCount(p2Sprites.takeHit);
    const deathFramesP1 = this.getFrameCount(p1Sprites.death);
    const deathFramesP2 = this.getFrameCount(p2Sprites.death);

    // Get actual sprite dimensions
    const idleFrameP1 = this.getFrame(p1Sprites.idle, 0, idleFramesP1);
    const idleFrameP2 = this.getFrame(p2Sprites.idle, 0, idleFramesP2);

    // === Dynamic Layout Calculation ===
    const uiTop = 70; // Ruimte voor naam + HP bar
    const groundY = this.height - 15; // Grondlijn
    const availableHeight = Math.max(60, groundY - uiTop);
    const desiredCharHeight = Math.min(240, availableHeight); // GROTER (was 200)

    // Scale beide sprites naar dezelfde DOEL hoogte
    const scaleP1 = Math.max(0.5, Math.min(4.0, desiredCharHeight / idleFrameP1.sh));
    const scaleP2 = Math.max(0.5, Math.min(4.0, desiredCharHeight / idleFrameP2.sh));

    const p1ScaledW = idleFrameP1.sw * scaleP1;
    const p2ScaledW = idleFrameP2.sw * scaleP2;
    const p1ScaledH = idleFrameP1.sh * scaleP1;
    const p2ScaledH = idleFrameP2.sh * scaleP2;

    const overlap = Math.min(p1ScaledW, p2ScaledW) * 0.20;
    const spacing = -overlap;
    const totalWidth = p1ScaledW + p2ScaledW + spacing;
    const startX = (this.width - totalWidth) / 2;

    const p1X = startX;
    const p2X = startX + p1ScaledW + spacing;

    const p1Center = p1X + p1ScaledW / 2;
    const p2Center = p2X + p2ScaledW / 2;

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

    // VASTE Y-positie voor beide characters (op dezelfde grondlijn)
    const p1Y = groundY - p1ScaledH;
    const p2Y = groundY - p2ScaledH;

    // Helper to draw a frame
    const drawFrame = (p1Frame, p2Frame, showSplat = null, splatDamage = 0) => {
      if (backgroundOverride) {
        ctx.drawImage(backgroundOverride, 0, 0, this.width, this.height);
      } else {
        this.drawBackground(ctx);
      }
      
      // Gebruik vaste Y-positie zodat beide characters op dezelfde hoogte staan
      this.drawCharacter(ctx, p1Frame, p1X, p1Y, scaleP1, false);
      this.drawCharacter(ctx, p2Frame, p2X, p2Y, scaleP2, true);
      
      // Draw hit splat
      if (showSplat === 1) {
        this.drawHitSplat(ctx, p1Center, groundY - (p1ScaledH * 0.6), splatDamage);
      } else if (showSplat === 2) {
        this.drawHitSplat(ctx, p2Center, groundY - (p2ScaledH * 0.6), splatDamage);
      }
      
      this.drawName(ctx, player1.name, p1Center, 15);
      this.drawName(ctx, player2.name, p2Center, 15);
      this.drawHpBar(ctx, p1Center - 40, 32, Math.max(0, currentP1Hp), player1.maxHp);
      this.drawHpBar(ctx, p2Center - 40, 32, Math.max(0, currentP2Hp), player2.maxHp);
      
      encoder.addFrame(ctx.getImageData(0, 0, this.width, this.height).data);
    };

    // ====== START MET IDLE FRAMES ======
    const introIdleFrames = 4; // Korte intro
    for (let i = 0; i < introIdleFrames; i++) {
      const p1Idle = this.getFrame(p1Sprites.idle, i % idleFramesP1, idleFramesP1);
      const p2Idle = this.getFrame(p2Sprites.idle, i % idleFramesP2, idleFramesP2);
      drawFrame(p1Idle, p2Idle);
    }

    // Process each attack in order
    for (const attack of attacks) {
      const { attacker, damage, isMiss } = attack;
      const actualDamage = isMiss ? 0 : (damage || 0);

      // Attack animation - gebalanceerd voor goede zichtbaarheid
      const attackAnimFrames = 8; // Gebalanceerd (niet te kort, niet te lang)
      for (let i = 0; i < attackAnimFrames; i++) {
        const progress = i / (attackAnimFrames - 1);
        const attackFrameIdxP1 = Math.floor(progress * (attackFramesP1 - 1));
        const attackFrameIdxP2 = Math.floor(progress * (attackFramesP2 - 1));
        const hitFrameIdxP1 = Math.floor(progress * (hitFramesP1 - 1));
        const hitFrameIdxP2 = Math.floor(progress * (hitFramesP2 - 1));
        const showSplat = progress >= 0.5;

        let p1Frame, p2Frame;
        let splatTarget = null;
        let splatDamage = actualDamage;

        if (attacker === 1) {
          // Player 1 attacks Player 2
          p1Frame = this.getFrame(p1Sprites.attack1, attackFrameIdxP1, attackFramesP1);
          p2Frame = (showSplat && actualDamage > 0)
            ? this.getFrame(p2Sprites.takeHit, hitFrameIdxP2, hitFramesP2)
            : this.getFrame(p2Sprites.idle, 0, idleFramesP2);
          
          if (showSplat) {
            splatTarget = 2;
            // HP update op frame 4 (midden van 8 frames)
            if (i === 4) currentP2Hp = Math.max(0, currentP2Hp - actualDamage);
          }
        } else {
          // Player 2 attacks Player 1
          p2Frame = this.getFrame(p2Sprites.attack1, attackFrameIdxP2, attackFramesP2);
          p1Frame = (showSplat && actualDamage > 0)
            ? this.getFrame(p1Sprites.takeHit, hitFrameIdxP1, hitFramesP1)
            : this.getFrame(p1Sprites.idle, 0, idleFramesP1);
          
          if (showSplat) {
            splatTarget = 1;
            // HP update op frame 4 (midden van 8 frames)
            if (i === 4) currentP1Hp = Math.max(0, currentP1Hp - actualDamage);
          }
        }

        drawFrame(p1Frame, p2Frame, showSplat ? splatTarget : null, splatDamage);
      }

      // Idle pauze tussen aanvallen
      for (let j = 0; j < 3; j++) { // Gebalanceerd
        const p1Idle = this.getFrame(p1Sprites.idle, j % idleFramesP1, idleFramesP1);
        const p2Idle = this.getFrame(p2Sprites.idle, j % idleFramesP2, idleFramesP2);
        drawFrame(p1Idle, p2Idle);
      }
    }

    if (isFinal && winner) {
      // Winner celebration
      const finalFrames = 16; // Gebalanceerd
      for (let i = 0; i < finalFrames; i++) {
        const p1Idle = this.getFrame(p1Sprites.idle, i % idleFramesP1, idleFramesP1);
        const p2Idle = this.getFrame(p2Sprites.idle, i % idleFramesP2, idleFramesP2);
        const deathProgress = Math.min(i / (finalFrames - 1), 1);
        const deathFrameIdxP1 = Math.floor(deathProgress * (deathFramesP1 - 1));
        const deathFrameIdxP2 = Math.floor(deathProgress * (deathFramesP2 - 1));
        const p1Death = this.getFrame(p1Sprites.death, deathFrameIdxP1, deathFramesP1);
        const p2Death = this.getFrame(p2Sprites.death, deathFrameIdxP2, deathFramesP2);

        if (backgroundOverride) {
          ctx.drawImage(backgroundOverride, 0, 0, this.width, this.height);
        } else {
          this.drawBackground(ctx);
        }

        // Gebruik dezelfde vaste Y-positie voor consistentie
        if (winner === 1) {
          this.drawCharacter(ctx, p1Idle, p1X, p1Y, scaleP1, false);
          this.drawCharacter(ctx, p2Death, p2X, p2Y, scaleP2, true);
        } else {
          this.drawCharacter(ctx, p1Death, p1X, p1Y, scaleP1, false);
          this.drawCharacter(ctx, p2Idle, p2X, p2Y, scaleP2, true);
        }

        this.drawName(ctx, player1.name, p1Center, 15);
        this.drawName(ctx, player2.name, p2Center, 15);
        this.drawHpBar(ctx, p1Center - 40, 32, Math.max(0, currentP1Hp), player1.maxHp);
        this.drawHpBar(ctx, p2Center - 40, 32, Math.max(0, currentP2Hp), player2.maxHp);

        // Winner text
        const winnerName = winner === 1 ? player1.name : player2.name;
        ctx.fillStyle = "#ffd700";
        ctx.font = "bold 22px Arial";
        ctx.textAlign = "center";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        ctx.strokeText(`${winnerName} WINS!`, this.width / 2, this.height / 2 - 10);
        ctx.fillText(`${winnerName} WINS!`, this.width / 2, this.height / 2 - 10);

        // Laatste frame krijgt zeer lange delay zodat GIF stilstaat
        if (i === finalFrames - 1) {
          encoder.setDelay(10000); // 10 seconden - blijft stilstaan
        } else if (i < 6) {
          encoder.setDelay(this.frameDelay);
        } else if (i < 12) {
          encoder.setDelay(200);
        } else {
          encoder.setDelay(350);
        }
        
        encoder.addFrame(ctx.getImageData(0, 0, this.width, this.height).data);
      }
    } else {
      encoder.setDelay(10000); // Stilstaand
      const p1Idle = this.getFrame(p1Sprites.idle, 0, idleFramesP1);
      const p2Idle = this.getFrame(p2Sprites.idle, 0, idleFramesP2);
      drawFrame(p1Idle, p2Idle);
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
  async generateFullBattleGif(battleData, spritePacks = null) {
    const { player1, player2, rounds, winner } = battleData;

    if (!this.isReady()) throw new Error("Sprites not loaded!");
    if (!rounds || rounds.length === 0) throw new Error("No rounds provided");

    const encoder = new GIFEncoder(this.width, this.height);
    encoder.setDelay(this.frameDelay);
    encoder.setRepeat(-1); // Geen loop - stopt aan het einde
    encoder.setQuality(10);
    encoder.start();

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d");

    // Determine sprites
    const p1Sprites = spritePacks?.p1 || this.sprites;
    const p2Sprites = spritePacks?.p2 || this.sprites;
    const backgroundOverride = spritePacks?.backgroundImage || null;

    // Get frame counts
    const idleFramesP1 = this.getFrameCount(p1Sprites.idle);
    const idleFramesP2 = this.getFrameCount(p2Sprites.idle);
    const attackFramesP1 = this.getFrameCount(p1Sprites.attack1);
    const attackFramesP2 = this.getFrameCount(p2Sprites.attack1);
    const hitFramesP1 = this.getFrameCount(p1Sprites.takeHit);
    const hitFramesP2 = this.getFrameCount(p2Sprites.takeHit);
    const deathFramesP1 = this.getFrameCount(p1Sprites.death);
    const deathFramesP2 = this.getFrameCount(p2Sprites.death);

    // Get actual sprite dimensions
    const idleFrameP1 = this.getFrame(p1Sprites.idle, 0, idleFramesP1);
    const idleFrameP2 = this.getFrame(p2Sprites.idle, 0, idleFramesP2);

    // === Dynamic Layout Calculation (zelfde als generateLiveHitGif) ===
    const uiTop = 70; // Ruimte voor naam + HP bar
    const groundY = this.height - 15; // Grondlijn
    const availableHeight = Math.max(60, groundY - uiTop);
    const desiredCharHeight = Math.min(240, availableHeight); // GROTER

    const scaleP1 = Math.max(0.5, Math.min(4.0, desiredCharHeight / idleFrameP1.sh));
    const scaleP2 = Math.max(0.5, Math.min(4.0, desiredCharHeight / idleFrameP2.sh));

    const p1ScaledW = idleFrameP1.sw * scaleP1;
    const p2ScaledW = idleFrameP2.sw * scaleP2;
    const p1ScaledH = idleFrameP1.sh * scaleP1;
    const p2ScaledH = idleFrameP2.sh * scaleP2;

    const overlap = Math.min(p1ScaledW, p2ScaledW) * 0.20;
    const spacing = -overlap;
    const totalWidth = p1ScaledW + p2ScaledW + spacing;
    const startX = (this.width - totalWidth) / 2;

    const p1X = startX;
    const p2X = startX + p1ScaledW + spacing;

    const p1Center = p1X + p1ScaledW / 2;
    const p2Center = p2X + p2ScaledW / 2;

    // VASTE Y-positie voor beide characters
    const p1Y = groundY - p1ScaledH;
    const p2Y = groundY - p2ScaledH;

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
      if (backgroundOverride) {
        ctx.drawImage(backgroundOverride, 0, 0, this.width, this.height);
      } else {
        this.drawBackground(ctx);
      }
      const p1Idle = this.getFrame(p1Sprites.idle, roundIndex % idleFramesP1, idleFramesP1);
      const p2Idle = this.getFrame(p2Sprites.idle, roundIndex % idleFramesP2, idleFramesP2);
      
      // Gebruik vaste Y-positie
      this.drawCharacter(ctx, p1Idle, p1X, p1Y, scaleP1, false);
      this.drawCharacter(ctx, p2Idle, p2X, p2Y, scaleP2, true);
      
      this.drawName(ctx, player1.name, p1Center, 15);
      this.drawName(ctx, player2.name, p2Center, 15);
      this.drawHpBar(ctx, p1Center - 40, 32, currentP1Hp, player1.maxHp);
      this.drawHpBar(ctx, p2Center - 40, 32, currentP2Hp, player2.maxHp);
      encoder.addFrame(ctx.getImageData(0, 0, this.width, this.height).data);

      // Phase 2: Attack animation - gebalanceerd
      const attackAnimFrames = 8; // Gebalanceerd
      for (let i = 0; i < attackAnimFrames; i++) {
        if (backgroundOverride) {
          ctx.drawImage(backgroundOverride, 0, 0, this.width, this.height);
        } else {
          this.drawBackground(ctx);
        }

        const progress = i / (attackAnimFrames - 1);
        const attackFrameIdxP1 = Math.floor(progress * (attackFramesP1 - 1));
        const attackFrameIdxP2 = Math.floor(progress * (attackFramesP2 - 1));
        const hitFrameIdxP1 = Math.floor(progress * (hitFramesP1 - 1));
        const hitFrameIdxP2 = Math.floor(progress * (hitFramesP2 - 1));
        const showSplat = progress >= 0.5;

        // Update HP when splat shows (op frame 4)
        if (showSplat && i === 4) {
          currentP1Hp = Math.max(0, p1Hp);
          currentP2Hp = Math.max(0, p2Hp);
        }

        let p1Frame, p2Frame;
        if (attacker === 1) {
          p1Frame = this.getFrame(p1Sprites.attack1, attackFrameIdxP1, attackFramesP1);
          p2Frame = showSplat && damage > 0
            ? this.getFrame(p2Sprites.takeHit, hitFrameIdxP2, hitFramesP2)
            : this.getFrame(p2Sprites.idle, 0, idleFramesP2);
        } else {
          p2Frame = this.getFrame(p2Sprites.attack1, attackFrameIdxP2, attackFramesP2);
          p1Frame = showSplat && damage > 0
            ? this.getFrame(p1Sprites.takeHit, hitFrameIdxP1, hitFramesP1)
            : this.getFrame(p1Sprites.idle, 0, idleFramesP1);
        }

        // Gebruik vaste Y-positie
        this.drawCharacter(ctx, p1Frame, p1X, p1Y, scaleP1, false);
        this.drawCharacter(ctx, p2Frame, p2X, p2Y, scaleP2, true);

        if (showSplat && damage > 0) {
          if (attacker === 1) {
            this.drawHitSplat(ctx, p2Center, groundY - (p2ScaledH * 0.6), damage);
          } else {
            this.drawHitSplat(ctx, p1Center, groundY - (p1ScaledH * 0.6), damage);
          }
        }

        this.drawName(ctx, player1.name, p1Center, 15);
        this.drawName(ctx, player2.name, p2Center, 15);
        this.drawHpBar(ctx, p1Center - 40, 32, currentP1Hp, player1.maxHp);
        this.drawHpBar(ctx, p2Center - 40, 32, currentP2Hp, player2.maxHp);
        encoder.addFrame(ctx.getImageData(0, 0, this.width, this.height).data);
      }
    }

    // Final frames: Winner celebration
    const finalFrames = 16; // Gebalanceerd
    for (let i = 0; i < finalFrames; i++) {
      if (backgroundOverride) {
        ctx.drawImage(backgroundOverride, 0, 0, this.width, this.height);
      } else {
        this.drawBackground(ctx);
      }

      const idleFrameIdxP1 = i % idleFramesP1;
      const idleFrameIdxP2 = i % idleFramesP2;
      const deathProgress = Math.min(i / (finalFrames - 1), 1);
      const deathFrameIdxP1 = Math.floor(deathProgress * (deathFramesP1 - 1));
      const deathFrameIdxP2 = Math.floor(deathProgress * (deathFramesP2 - 1));

      let p1Frame, p2Frame;
      if (winner === 1) {
        p1Frame = this.getFrame(p1Sprites.idle, idleFrameIdxP1, idleFramesP1);
        p2Frame = this.getFrame(p2Sprites.death, deathFrameIdxP2, deathFramesP2);
      } else {
        p1Frame = this.getFrame(p1Sprites.death, deathFrameIdxP1, deathFramesP1);
        p2Frame = this.getFrame(p2Sprites.idle, idleFrameIdxP2, idleFramesP2);
      }

      // Gebruik vaste Y-positie
      this.drawCharacter(ctx, p1Frame, p1X, p1Y, scaleP1, false);
      this.drawCharacter(ctx, p2Frame, p2X, p2Y, scaleP2, true);

      this.drawName(ctx, player1.name, p1Center, 15);
      this.drawName(ctx, player2.name, p2Center, 15);
      this.drawHpBar(ctx, p1Center - 40, 32, currentP1Hp, player1.maxHp);
      this.drawHpBar(ctx, p2Center - 40, 32, currentP2Hp, player2.maxHp);

      // Winner text (with pulsing effect)
      const winnerName = winner === 1 ? player1.name : player2.name;
      const pulse = 1 + Math.sin(i * 0.8) * 0.1;
      
      ctx.save();
      ctx.translate(this.width / 2, this.height / 2 - 10);
      ctx.scale(pulse, pulse);
      
      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 22px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 4;
      ctx.strokeText(`${winnerName} WINS!`, 0, 0);
      ctx.fillText(`${winnerName} WINS!`, 0, 0);
      
      ctx.restore();

      // Progressieve delay - laatste frame krijgt zeer lange delay
      if (i === finalFrames - 1) {
        encoder.setDelay(10000); // 10 seconden - blijft stilstaan aan het einde
      } else if (i < 6) {
        encoder.setDelay(this.frameDelay);
      } else if (i < 12) {
        encoder.setDelay(200);
      } else {
        encoder.setDelay(350);
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


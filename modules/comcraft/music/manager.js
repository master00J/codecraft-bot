/**
 * ComCraft Music Player Manager
 * Full-featured music player with queue management, playlists, and controls
 */

// Import Opus encoder early so discord-player can detect it
// Try multiple Opus encoders in order of preference
// Note: @discordjs/opus is not included as it requires native build and fails on Railway
let opusEncoderFound = false;
let opusEncoderName = null;

// Try mediaplex first (recommended by discord-player, no native build required)
try {
  require('mediaplex');
  console.log('✅ [Music] mediaplex loaded (recommended Opus encoder)');
  opusEncoderFound = true;
  opusEncoderName = 'mediaplex';
} catch (error) {
  console.warn('⚠️ [Music] mediaplex not found, trying opusscript...');
}

// Try opusscript as fallback (pure JS, no native dependencies)
if (!opusEncoderFound) {
  try {
    require('opusscript');
    console.log('✅ [Music] opusscript loaded (fallback Opus encoder)');
    opusEncoderFound = true;
    opusEncoderName = 'opusscript';
  } catch (opusError) {
    console.error('❌ [Music] No Opus encoder found! Install one of:');
    console.error('   - npm install mediaplex (recommended)');
    console.error('   - npm install opusscript (fallback)');
  }
}

let Player;
try {
  Player = require('discord-player').Player;
} catch (error) {
  console.error('❌ [Music] discord-player module not found. Please run: npm install discord-player @discordjs/voice play-dl ffmpeg-static');
  Player = null;
}

const { EmbedBuilder } = require('discord.js');
const configManager = require('../config-manager');
const FeatureGate = require('../feature-gate');

const MUSIC_FEATURE = 'music_player';

class MusicManager {
  constructor(client) {
    this.client = client;
    this.player = null;
    this.featureGate = new FeatureGate(configManager);
    this.isAvailable = Player !== null;
    this.initialized = false;
    
    if (!this.isAvailable) {
      console.warn('⚠️ [Music] Music player is disabled - dependencies not installed');
      return;
    }
    
    // Note: initializePlayer() is called separately to allow async/await
  }

  async initializePlayer() {
    if (!this.isAvailable || !Player) {
      console.warn('⚠️ [Music] Cannot initialize player - discord-player not available');
      return;
    }

    try {
            // Try to get FFmpeg path - prefer system FFmpeg (Railway has it pre-installed)
            let ffmpegPath = null;
            try {
              // ✅ Use Railway's system FFmpeg first
              const { execSync } = require('child_process');
              ffmpegPath = execSync('which ffmpeg', { encoding: 'utf8' }).trim();
              console.log('✅ [Music] Using system FFmpeg:', ffmpegPath);
            } catch (e) {
              console.warn('⚠️ [Music] System FFmpeg not found, trying static...');
              try {
                const ffmpegStatic = require('ffmpeg-static');
                if (ffmpegStatic) {
                  ffmpegPath = ffmpegStatic;
                  console.log('✅ [Music] Using explicit FFmpeg path:', ffmpegPath);
                }
              } catch (e2) {
                console.error('❌ [Music] No FFmpeg found!');
              }
            }
            
            this.player = new Player(this.client, {
              // Explicitly set FFmpeg path if available
              // Note: discord-player v7 accepts ffmpeg as a string path, not an object
              ...(ffmpegPath && { ffmpeg: ffmpegPath }),
              
              // Note: ytdlOptions are not needed when using youtubei extractor
              // The extractor handles YouTube stream extraction internally
              skipFFmpeg: false,
              useLegacyFFmpeg: false,
              connectionTimeout: 60000,
              smoothVolume: true,
              bufferingTimeout: 30000, // 30 seconds for buffering (increased for slow connections)
              leaveOnStop: false,
              leaveOnEmpty: true,
              leaveOnEmptyCooldown: 300000,
              leaveOnEnd: false,
              leaveOnEndCooldown: 300000,
              autoSelfDeaf: true,
              emitNewPlayerOnly: false
            });

      // Load extractors from @discord-player/extractor
      // Discord-player v7 requires manual extractor loading
      try {
        const { DefaultExtractors } = require('@discord-player/extractor');
        console.log('📦 [Music] Loading default extractors...');
        await this.player.extractors.loadMulti(DefaultExtractors);
        
        // Load YouTube extractor separately (not included in DefaultExtractors)
        // Note: This extractor may show warnings about signature deciphering, but should still work
        try {
          console.log('📦 [Music] Loading YouTube extractor...');
          const { YoutubeiExtractor } = require('discord-player-youtubei');
          
          // Suppress console warnings temporarily during registration
          const originalWarn = console.warn;
          const originalError = console.error;
          console.warn = (...args) => {
            // Filter out YouTube signature warnings and parser warnings (they're harmless)
            const message = args[0]?.toString() || '';
            if (message.includes('signature decipher') ||
                message.includes('Unable to find matching run') ||
                message.includes('GridShelfView not found') ||
                message.includes('SectionHeaderView not found') ||
                message.includes('This is a bug, want to help us fix it')) {
              return; // Suppress these specific warnings
            }
            originalWarn.apply(console, args);
          };
          console.error = (...args) => {
            // Filter out YouTube parser errors (they're harmless - JIT generated)
            const message = args[0]?.toString() || '';
            if (message.includes('InnertubeError') ||
                message.includes('GridShelfView not found') ||
                message.includes('SectionHeaderView not found') ||
                message.includes('This is a bug, want to help us fix it')) {
              return; // Suppress these specific errors
            }
            originalError.apply(console, args);
          };
          
          // Register YouTube extractor with authentication if available
          const youtubeConfig = {};
          if (process.env.YOUTUBE_COOKIE) {
            youtubeConfig.authentication = process.env.YOUTUBE_COOKIE;
            console.log('   ✅ Using YouTube cookie for authentication');
          }
          
          await this.player.extractors.register(YoutubeiExtractor, {
            ...youtubeConfig,
            // Add stream fallback options
            streamOptions: {
              useClient: 'ANDROID', // More reliable for audio
              highWaterMark: 1 << 25,
            }
          });
          
          // Restore original console methods
          console.warn = originalWarn;
          console.error = originalError;
          
          console.log('✅ [Music] YouTube extractor registered');
        } catch (youtubeError) {
          console.warn('⚠️ [Music] youtubei failed, trying fallback...');
          console.warn('   Error:', youtubeError.message);
          
          // Fallback to older but stable youtube-ext extractor
          try {
            const { YouTubeExtractor } = require('@discord-player/extractor');
            await this.player.extractors.register(YouTubeExtractor);
            console.log('✅ [Music] Fallback YouTube extractor registered');
          } catch (fallbackError) {
            console.error('❌ [Music] All YouTube extractors failed');
            console.error('   youtubei error:', youtubeError.message);
            console.error('   fallback error:', fallbackError.message);
            console.error('   YouTube playback will not work');
          }
        }
        
        this.initialized = true;
        
        // Always log extractors for debugging
        const extractors = this.player.extractors.store;
        console.log(`✅ [Music] Extractors loaded successfully (${extractors.size} extractors)`);
        extractors.forEach((extractor, name) => {
          console.log(`   ✓ ${name}`);
        });
      } catch (extractorError) {
        console.error('❌ [Music] Failed to load extractors:', extractorError.message);
        console.error('   Stack:', extractorError.stack);
        console.error('   Make sure @discord-player/extractor is installed: npm install @discord-player/extractor');
        this.isAvailable = false; // Disable music player if extractors can't be loaded
        throw extractorError; // Re-throw to be caught by constructor
      }

      // Player events
      this.player.events.on('playerStart', async (queue, track) => {
        console.log(`🎵 [Music] PlayerStart event: ${track.title} in ${queue.guild.name}`);
        console.log(`   Queue is playing: ${queue.node.isPlaying()}`);
        
        // Just notify the channel - don't verify resource here
        // Resource verification is done in handlePlay method if needed
        // discord-player v7 manages resources internally
        this.onTrackStart(queue, track);
      });

      this.player.events.on('playerFinish', (queue) => {
        console.log(`🏁 [Music] PlayerFinish event in ${queue.guild.name}`);
        console.log(`   Queue tracks remaining: ${queue.tracks.size}`);
        console.log(`   Queue is playing: ${queue.node.isPlaying()}`);
        // Only show queue finished message if queue is actually empty
        if (queue.tracks.size === 0) {
          this.onQueueFinish(queue);
        }
      });

      this.player.events.on('error', (queue, error) => {
        console.error(`❌ [Music] Player error in ${queue?.guild?.name || 'unknown'}:`, error);
        console.error(`   Error message:`, error.message);
        console.error(`   Error stack:`, error.stack);
      });
      
      this.player.events.on('playerError', (queue, error, track) => {
        console.error(`❌ [Music] PlayerError event in ${queue?.guild?.name || 'unknown'}:`, error);
        console.error(`   Track: ${track?.title || 'unknown'}`);
        console.error(`   Track URL: ${track?.url || 'unknown'}`);
        console.error(`   Error message:`, error.message);
        console.error(`   Error name:`, error.name);
        console.error(`   Error stack:`, error.stack);
      });

      // Additional error handlers for better debugging
      this.player.events.on('audioTrackError', (queue, track, error) => {
        console.error(`❌ [Music] AudioTrackError on ${track?.title || 'unknown'} in ${queue?.guild?.name || 'unknown'}:`, error);
        console.error(`   Track URL: ${track?.url || 'unknown'}`);
        console.error(`   Error message:`, error.message);
        console.error(`   Error name:`, error.name);
        console.error(`   Error stack:`, error.stack);
        console.error(`   This usually indicates the audio stream couldn't be processed`);
      });
      
      // Track resource errors
      this.player.events.on('trackException', (queue, error, track) => {
        console.error(`❌ [Music] TrackException - Playback failed:`, error);
        console.error(`   Track: ${track?.title || 'unknown'}`);
        console.error(`   Track URL: ${track?.url || 'unknown'}`);
        console.error(`   Error name: ${error.name || 'unknown'}`);
        console.error(`   Error message: ${error.message || 'unknown'}`);
        console.error(`   Error code: ${error.code || 'none'}`);
        console.error(`   Error stack: ${error.stack || 'none'}`);
        
        // Log FFmpeg-specific errors
        if (error.message?.includes('ffmpeg') || error.message?.includes('FFmpeg')) {
          console.error(`   🔧 This is an FFmpeg error - check FFmpeg installation`);
        }
        
        // Log network errors
        if (error.message?.includes('ECONNRESET') || error.message?.includes('ENOTFOUND')) {
          console.error(`   🌐 This is a network error - check connectivity/YouTube access`);
        }
        
        // Log timeout errors
        if (error.message?.includes('timeout')) {
          console.error(`   ⏱️ This is a timeout error - stream extraction took too long`);
        }
        
        // Log YouTube signature deciphering errors
        if (error.message?.includes('signature') || error.message?.includes('decipher')) {
          console.error(`   🎵 This is a YouTube signature deciphering error`);
          console.error(`   This usually means YouTube changed their API or the extractor needs updating`);
          console.error(`   Try: npm update discord-player-youtubei youtubei.js`);
        }
        
        // Try to send error to channel
        if (queue?.metadata?.channel) {
          const { EmbedBuilder } = require('discord.js');
          try {
            queue.metadata.channel.send({
              embeds: [new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('❌ Playback Error')
                .setDescription(`Failed to play **${track?.title || 'track'}**`)
                .addFields(
                  { name: 'Error', value: error.message?.substring(0, 1000) || 'Unknown error', inline: false }
                )
                .setFooter({ text: 'Try a different track or check logs for details' })
              ]
            }).catch(() => {});
          } catch (sendError) {
            // Ignore send errors
          }
        }
      });
      
      // Audio player errors
      this.player.events.on('audioPlayerError', (queue, error, track) => {
        console.error(`❌ [Music] AudioPlayerError in ${queue?.guild?.name || 'unknown'}:`, error);
        console.error(`   Track: ${track?.title || 'unknown'}`);
        console.error(`   Error message:`, error.message);
        console.error(`   Error name:`, error.name);
        console.error(`   Error stack:`, error.stack);
      });
      
      // Resource creation errors
      this.player.events.on('resourceCreateError', (queue, error, track) => {
        console.error(`❌ [Music] Resource creation failed for ${track?.title || 'unknown'}:`, error.message);
        
        // Send immediate feedback to channel
        if (queue?.metadata?.channel) {
          const { EmbedBuilder } = require('discord.js');
          queue.metadata.channel.send({
            embeds: [new EmbedBuilder()
              .setColor('#FF6B6B')
              .setTitle('❌ Failed to Load Audio')
              .setDescription(`Could not create audio stream for **${track?.title || 'track'}**`)
              .addFields(
                { name: 'Error', value: error.message.substring(0, 1000), inline: false },
                { name: 'Solution', value: 'Try a different track or check FFmpeg installation', inline: false }
              )
            ]
          }).catch(() => {});
        }
      });
      
      this.player.events.on('trackStart', (queue, track) => {
        console.log(`▶️ [Music] TrackStart event: ${track.title} in ${queue.guild.name}`);
      });
      
      this.player.events.on('trackEnd', (queue, track) => {
        console.log(`⏹️ [Music] TrackEnd event: ${track.title} in ${queue.guild.name}`);
      });
      
      // Add audio player events for debugging
      this.player.events.on('audioTrackAdd', (queue, track) => {
        console.log(`🔊 [Music] AudioTrackAdd: ${track.title} in ${queue.guild.name}`);
      });
      
      this.player.events.on('audioTracksAdd', (queue, tracks) => {
        console.log(`🔊 [Music] AudioTracksAdd: ${tracks.length} tracks in ${queue.guild.name}`);
      });
      
      this.player.events.on('connectionCreate', (queue) => {
        console.log(`🔌 [Music] ConnectionCreate in ${queue.guild.name}`);
      });
      
      this.player.events.on('connectionError', (queue, error) => {
        console.error(`❌ [Music] ConnectionError in ${queue.guild.name}:`, error);
        console.error(`   Error message:`, error.message);
        console.error(`   Error name:`, error.name);
        console.error(`   Error stack:`, error.stack);
        if (error.message && error.message.includes('IP discovery')) {
          console.error(`   ⚠️ UDP connection failed - this usually means:`);
          console.error(`   - UDP ports are not open on your server`);
          console.error(`   - Firewall is blocking UDP traffic`);
          console.error(`   - Pterodactyl allocations don't include UDP`);
          console.error(`   See PTERODACTYL_VOICE_FIX.md for solutions`);
        }
      });

      // Additional error handler for audio track errors (suggested by ChatGPT)
      this.player.events.on('audioTrackError', (queue, track, error) => {
        console.error(`❌ [Music] AudioTrackError on ${track?.title || 'unknown'} in ${queue?.guild?.name || 'unknown'}:`, error);
        console.error(`   Track URL: ${track?.url || 'unknown'}`);
        console.error(`   Error message:`, error.message);
        console.error(`   Error name:`, error.name);
        console.error(`   Error stack:`, error.stack);
        console.error(`   This usually indicates the audio stream couldn't be processed`);
        console.error(`   Possible causes:`);
        console.error(`   - Opus encoder not found or not working`);
        console.error(`   - FFmpeg cannot process the audio stream`);
        console.error(`   - Audio resource creation failed`);
      });

      this.player.events.on('debug', (queue, message) => {
        if (process.env.DEBUG_MUSIC === 'true') {
          console.log(`🔍 [Music] ${queue.guild.name}: ${message}`);
        }
      });

      // Check dependencies with scanDeps() + manual verification
      console.log('🔍 [Music] Scanning dependencies...');
      let scanDepsResult = null;
      try {
        scanDepsResult = this.player.scanDeps();
        console.log('📊 [Music] scanDeps() results:');
        console.log('   FFmpeg:', scanDepsResult.ffmpeg ? '✅ Found' : '❌ Missing');
        console.log('   Opus:', scanDepsResult.opus ? `✅ Found (${scanDepsResult.opus})` : '❌ Missing');
        console.log('   Encoder:', scanDepsResult.encoder ? `✅ Found (${scanDepsResult.encoder})` : '❌ Missing');
      } catch (scanError) {
        console.warn('⚠️ [Music] scanDeps() failed:', scanError.message);
      }

      // Manual verification (scanDeps() can give false negatives)
      console.log('🔍 [Music] Manual dependency verification...');
      let ffmpegFound = false;
      let opusFound = false;
      let opusName = null;

      // Check FFmpeg
      try {
        const ffmpeg = require('ffmpeg-static');
        if (ffmpeg) {
          ffmpegFound = true;
          console.log('   ✅ FFmpeg: Found via ffmpeg-static');
        }
      } catch (e) {
        // FFmpeg check happens below
      }

      // Check Opus encoders
      try {
        require.resolve('mediaplex');
        opusFound = true;
        opusName = 'mediaplex';
        console.log('   ✅ Opus: Found (mediaplex)');
      } catch (e) {
        try {
          require.resolve('opusscript');
          opusFound = true;
          opusName = 'opusscript';
          console.log('   ✅ Opus: Found (opusscript)');
        } catch (e2) {
          // @discordjs/opus removed - requires native build and fails on Railway
          console.warn('   ⚠️ Opus: Not found (tried mediaplex, opusscript)');
        }
      }

      // Final status
      console.log('📊 [Music] Final dependency status:');
      console.log(`   FFmpeg: ${ffmpegFound ? '✅ Available' : '❌ Missing'}`);
      console.log(`   Opus: ${opusFound ? `✅ Available (${opusName})` : '❌ Missing'}`);
      
      if (!opusFound) {
        console.error('❌ [Music] CRITICAL: No Opus encoder found!');
        console.error('   discord-player requires an Opus encoder to work.');
        console.error('   Install one of: npm install mediaplex (recommended) or npm install opusscript');
      } else if (!scanDepsResult?.opus) {
        console.warn('⚠️ [Music] Note: scanDeps() did not detect Opus, but manual check found it.');
        console.warn('   This is a known issue with scanDeps() - the encoder is available and will work.');
      }
      
      if (!ffmpegFound) {
        console.error('❌ [Music] CRITICAL: FFmpeg not found!');
        console.error('   Install: npm install ffmpeg-static');
      } else if (!scanDepsResult?.ffmpeg) {
        console.warn('⚠️ [Music] Note: scanDeps() did not detect FFmpeg, but manual check found it.');
        console.warn('   This is a known issue with scanDeps() - FFmpeg is available and will work.');
      }

      // Test FFmpeg availability and functionality
      console.log('🔍 [Music] Testing FFmpeg availability...');
      try {
        const ffmpeg = require('ffmpeg-static');
        if (ffmpeg) {
          console.log('✅ [Music] FFmpeg found:', ffmpeg);
          
          // Test if FFmpeg is executable
          const fs = require('fs');
          console.log('🔍 [Music] Checking if FFmpeg is accessible...');
          try {
            fs.accessSync(ffmpeg, fs.constants.F_OK | fs.constants.X_OK);
            console.log('✅ [Music] FFmpeg is accessible and executable');
            
            // Try to get FFmpeg version
            console.log('🔍 [Music] Getting FFmpeg version...');
            const { execSync } = require('child_process');
            try {
              const version = execSync(`"${ffmpeg}" -version`, { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
              const versionLine = version.split('\n')[0];
              console.log(`✅ [Music] FFmpeg version: ${versionLine}`);
            } catch (versionError) {
              console.warn('⚠️ [Music] Could not get FFmpeg version:', versionError.message);
              console.warn('   Error code:', versionError.code);
              console.warn('   Error signal:', versionError.signal);
            }
          } catch (accessError) {
            console.error('❌ [Music] FFmpeg is not accessible or executable:', accessError.message);
            console.error('   Error code:', accessError.code);
            console.error('   This will cause audio playback to fail!');
          }
        } else {
          console.warn('⚠️ [Music] FFmpeg not found in ffmpeg-static package');
        }
      } catch (ffmpegError) {
        console.error('❌ [Music] Could not check FFmpeg:', ffmpegError.message);
        console.error('   Error stack:', ffmpegError.stack);
        console.warn('   Make sure ffmpeg-static is installed: npm install ffmpeg-static');
      }

      // Enhanced debug events
      this.player.events.on('debug', (queue, message) => {
        console.log(`🔍 [DP DEBUG] ${queue?.guild?.name || 'global'}: ${message}`);
      });

      console.log('✅ [Music] Player initialized');
    } catch (error) {
      console.error('❌ [Music] Failed to initialize player:', error);
      this.isAvailable = false;
    }
  }

  isPlayerAvailable() {
    // Return true if player exists and dependencies are available
    // initialized check is done separately in commands
    return this.isAvailable && this.player !== null;
  }
  
  isFullyInitialized() {
    return this.isAvailable && this.player !== null && this.initialized;
  }

  async onTrackStart(queue, track) {
    const channel = queue.metadata?.channel;
    if (!channel) return;

    try {
      const embed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle('🎵 Now Playing')
        .setDescription(`**[${track.title}](${track.url})**`)
        .setThumbnail(track.thumbnail)
        .addFields(
          {
            name: '👤 Requested by',
            value: track.requestedBy ? `<@${track.requestedBy.id}>` : 'Unknown',
            inline: true
          },
          {
            name: '⏱️ Duration',
            value: track.duration || 'Unknown',
            inline: true
          },
          {
            name: '📊 Queue',
            value: `${queue.tracks.size} track${queue.tracks.size !== 1 ? 's' : ''} in queue`,
            inline: true
          }
        )
        .setFooter({ text: `Volume: ${queue.node.volume}%` })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('❌ [Music] Error sending now playing embed:', error);
    }
  }

  async onQueueFinish(queue) {
    const channel = queue.metadata?.channel;
    if (!channel) return;

    try {
      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setDescription('🎵 Queue finished! Add more songs to keep the music playing.')
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('❌ [Music] Error sending queue finish message:', error);
    }
  }

  async checkFeature(guildId) {
    if (!this.isPlayerAvailable()) {
      return false;
    }
    return await this.featureGate.checkFeature(guildId, MUSIC_FEATURE);
  }

  async getQueue(guildId) {
    if (!this.isPlayerAvailable()) return null;
    return this.player.nodes.get(guildId);
  }

  async createQueue(interaction) {
    if (!this.isPlayerAvailable()) {
      throw new Error('Music player not available. Please install dependencies: npm install discord-player @discordjs/voice play-dl ffmpeg-static');
    }

    const queue = this.player.nodes.create(interaction.guild, {
      metadata: {
        channel: interaction.channel,
        client: interaction.guild.members.me,
        requestedBy: interaction.user
      },
      selfDeaf: true,
      volume: 50,
      leaveOnEmpty: true,
      leaveOnEmptyCooldown: 300000, // 5 minutes
      leaveOnEnd: false,
      leaveOnEndCooldown: 300000,
      // CRITICAL: Add these for better error handling
      bufferingTimeout: 10000, // Increase to 10 seconds
      skipOnNoStream: false
      // Note: FFmpeg config is set globally in Player constructor, not per-queue
      // Queue-specific error events are handled via this.player.events (already registered)
    });

    return queue;
  }

  async connectToVoiceChannel(interaction) {
    const member = interaction.member;
    if (!member.voice.channel) {
      throw new Error('You need to be in a voice channel!');
    }

    const queue = await this.getQueue(interaction.guild.id) || await this.createQueue(interaction);
    
    try {
      if (!queue.connection) {
        console.log(`🔌 [Music] Connecting to voice channel: ${member.voice.channel.name}`);
        
        // ✅ Simple and correct:
        await queue.connect(member.voice.channel);
        
        console.log(`✅ [Music] Connected to voice channel`);
      }
    } catch (error) {
      console.error(`❌ [Music] Failed to connect:`, error);
      this.player.nodes.delete(interaction.guild.id);
      throw new Error(`Failed to join voice channel: ${error.message}`);
    }
    
    return queue;
  }

  formatDuration(ms) {
    if (!ms || isNaN(ms)) return 'Unknown';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  }

  formatQueue(queue, page = 1, itemsPerPage = 10) {
    if (!queue || !queue.currentTrack) {
      return 'No music is currently playing.';
    }

    const tracks = queue.tracks.toArray();
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageTracks = tracks.slice(startIndex, endIndex);
    const totalPages = Math.ceil(tracks.length / itemsPerPage);

    let description = `**Now Playing:** [${queue.currentTrack.title}](${queue.currentTrack.url})\n\n`;
    
    if (pageTracks.length > 0) {
      description += '**Queue:**\n';
      pageTracks.forEach((track, index) => {
        const position = startIndex + index + 1;
        description += `${position}. [${track.title}](${track.url}) - ${this.formatDuration(track.durationMS)}\n`;
      });
      
      if (tracks.length > endIndex) {
        description += `\n... and ${tracks.length - endIndex} more track${tracks.length - endIndex !== 1 ? 's' : ''}`;
      }
      
      if (totalPages > 1) {
        description += `\n\n*Page ${page} of ${totalPages}*`;
      }
    } else {
      description += '*Queue is empty*';
    }

    return description;
  }
}

module.exports = MusicManager;


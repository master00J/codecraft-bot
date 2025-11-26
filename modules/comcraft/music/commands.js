/**
 * ComCraft Music Commands
 * Slash commands for music player functionality
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class MusicCommands {
  constructor(musicManager) {
    this.musicManager = musicManager;
  }

  /**
   * Register all music commands
   */
  getCommands() {
    return [
      // Play command
      new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song from YouTube, Spotify, SoundCloud, or other sources')
        .addStringOption(option =>
          option.setName('query')
            .setDescription('Song name, URL, or search query')
            .setRequired(true)
        ),

      // Pause command
      new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause the currently playing song'),

      // Resume command
      new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the paused song'),

      // Skip command
      new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip to the next song in the queue')
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Number of songs to skip (default: 1)')
            .setMinValue(1)
            .setMaxValue(10)
        ),

      // Stop command
      new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop the music and clear the queue'),

      // Queue command
      new SlashCommandBuilder()
        .setName('queue')
        .setDescription('View the current music queue')
        .addIntegerOption(option =>
          option.setName('page')
            .setDescription('Page number to view')
            .setMinValue(1)
        ),

      // Now Playing command
      new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show information about the currently playing song'),

      // Volume command
      new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set or view the music volume')
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Volume level (0-100)')
            .setMinValue(0)
            .setMaxValue(100)
        ),

      // Shuffle command
      new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Shuffle the queue'),

      // Remove command
      new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a song from the queue')
        .addIntegerOption(option =>
          option.setName('position')
            .setDescription('Position of the song to remove')
            .setRequired(true)
            .setMinValue(1)
        ),

      // Clear command
      new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear the entire queue'),

      // Loop command
      new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Loop the current song or queue')
        .addStringOption(option =>
          option.setName('mode')
            .setDescription('Loop mode')
            .setRequired(true)
            .addChoices(
              { name: 'Off', value: '0' },
              { name: 'Track', value: '1' },
              { name: 'Queue', value: '2' }
            )
        ),

      // Seek command
      new SlashCommandBuilder()
        .setName('seek')
        .setDescription('Seek to a specific time in the current song')
        .addStringOption(option =>
          option.setName('time')
            .setDescription('Time to seek to (e.g., 1:30 or 90s)')
            .setRequired(true)
        )
    ];
  }

  /**
   * Handle play command
   */
  async handlePlay(interaction) {
    // Check if already acknowledged - do this check multiple times to be safe
    if (interaction.deferred || interaction.replied) {
      console.warn('⚠️ [Music] Interaction already acknowledged (check 1), skipping');
      console.warn(`   deferred: ${interaction.deferred}, replied: ${interaction.replied}`);
      return;
    }

    try {
      // Double check before deferring
      if (interaction.deferred || interaction.replied) {
        console.warn('⚠️ [Music] Interaction already acknowledged (check 2), skipping');
        return;
      }
      
      // CRITICAL: Defer immediately to prevent interaction timeout (3 seconds)
      await interaction.deferReply();
    } catch (deferError) {
      // Handle interaction timeout or already acknowledged errors
      if (deferError.code === 40060 || deferError.code === 10062 || 
          deferError.message?.includes('already been acknowledged') ||
          deferError.message?.includes('Unknown interaction')) {
        console.warn('⚠️ [Music] Interaction expired or already acknowledged before deferReply, skipping');
        console.warn(`   Error code: ${deferError.code}, message: ${deferError.message}`);
        return;
      }
      // Re-throw other errors
      throw deferError;
    }

    try {
      // Check if music player is available
      if (!this.musicManager.isPlayerAvailable()) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('❌ Music Player Not Available')
            .setDescription('The music player dependencies are not installed. Please run:\n```bash\nnpm install discord-player @discordjs/voice play-dl ffmpeg-static\n```')
            .setFooter({ text: 'Contact your server administrator for assistance' })
          ],
          flags: 64 // Ephemeral flag
        });
      }
      
      // Check if extractors are fully initialized
      if (!this.musicManager.isFullyInitialized()) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⏳ Music Player Initializing')
            .setDescription('The music player is still initializing. Please wait a few seconds and try again.')
            .setFooter({ text: 'This usually takes 5-10 seconds after bot startup' })
          ],
          flags: 64 // Ephemeral flag
        });
      }

      // Check feature access
      const hasFeature = await this.musicManager.checkFeature(interaction.guild.id);
      if (!hasFeature) {
        return interaction.editReply({
          embeds: [this.musicManager.featureGate.createUpgradeEmbed('Music Player', 'Premium')],
          flags: 64 // Ephemeral flag
        });
      }

      let query = interaction.options.getString('query', true);
      console.log(`🔍 [Music] Original query: ${query}`);
      
      // Normalize YouTube URLs - remove query parameters that might confuse extractors
      if (query.includes('youtube.com/watch') || query.includes('youtu.be/')) {
        // Extract video ID from URL
        const videoIdMatch = query.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);
        if (videoIdMatch) {
          const videoId = videoIdMatch[1];
          query = `https://www.youtube.com/watch?v=${videoId}`;
          console.log(`🔧 [Music] Normalized YouTube URL: ${query}`);
        }
      }
      
      const queue = await this.musicManager.connectToVoiceChannel(interaction);

      // Search for the track with better error handling
      let searchResult;
      try {
        console.log(`🔍 [Music] Starting search for: ${query}`);
        
        // Check available extractors
        if (process.env.DEBUG_MUSIC === 'true') {
          const extractors = this.musicManager.player.extractors.store;
          console.log(`🐛 [Music Debug] Available extractors before search: ${extractors.size}`);
          extractors.forEach((extractor, name) => {
            console.log(`   - ${name} (identifier: ${extractor.identifier})`);
          });
        }
        
        // Try to search with the best extractor
        // For Spotify URLs, use Spotify extractor explicitly
        const searchOptions = {
          requestedBy: interaction.user
        };
        
        // If it's a Spotify URL, try to use Spotify extractor
        if (query.includes('open.spotify.com') || query.includes('spotify.com')) {
          searchOptions.searchEngine = 'spotify';
          console.log('🎵 [Music] Detected Spotify URL, using Spotify extractor');
        }
        
        searchResult = await this.musicManager.player.search(query, searchOptions);
        console.log(`📊 [Music] Search completed: hasTracks=${searchResult.hasTracks()}, tracks=${searchResult.tracks.length}, playlist=${searchResult.playlist ? searchResult.playlist.title : 'none'}`);
        
        if (searchResult.tracks.length > 0) {
          console.log(`   First track: ${searchResult.tracks[0].title} - ${searchResult.tracks[0].url}`);
        }
      } catch (searchError) {
        console.error('❌ [Music] Search error:', searchError);
        console.error('   Error stack:', searchError.stack);
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription(`❌ Error searching for **${query}**: ${searchError.message}\n\nTry:\n• A direct YouTube URL\n• Waiting a few minutes (rate limiting)`)
          ]
        });
      }

      if (!searchResult || !searchResult.hasTracks()) {
        console.warn(`⚠️ [Music] No tracks found for query: ${query}`);
        console.warn(`   Search result:`, {
          hasTracks: searchResult?.hasTracks() || false,
          tracks: searchResult?.tracks?.length || 0,
          playlist: searchResult?.playlist ? searchResult.playlist.title : null
        });
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription(`❌ No results found for: **${query}**\n\nTry:\n• A direct YouTube URL (e.g., https://www.youtube.com/watch?v=...)\n• A different search term\n• Waiting a few minutes (YouTube rate limiting)\n• Check Railway logs for more details`)
          ]
        });
      }

      // Add tracks to queue
      if (searchResult.playlist) {
        queue.addTrack(searchResult.tracks);
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#1DB954')
            .setDescription(`✅ Added **${searchResult.tracks.length} tracks** from playlist **${searchResult.playlist.title}** to the queue`)
            .setThumbnail(searchResult.playlist.thumbnail)
          ]
        });
      } else {
        const track = searchResult.tracks[0];
        console.log(`🎵 [Music] Adding track to queue: ${track.title} (${track.url})`);
        console.log(`   Track source: ${track.source || 'unknown'}`);
        console.log(`   Queue size before: ${queue.tracks.size}`);
        
        // CRITICAL: Validate stream creation before adding to queue
        if (!queue.node.isPlaying()) {
          console.log(`🔍 [Music] Validating audio stream...`);
          try {
            // Test stream extraction before playing
            // Note: In discord-player v7, we can't directly access extractor.createStream
            // Instead, we'll validate by attempting to play and checking if it fails immediately
            // The actual validation happens in the play() call below
            console.log(`   ✅ Stream validation will occur during playback`);
          } catch (streamError) {
            console.error('❌ Stream validation failed:', streamError.message);
            await interaction.editReply({
              embeds: [new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('❌ Stream Extraction Failed')
                .setDescription(`Could not extract audio from **${track.title}**\n\n**Error:** ${streamError.message}\n\n**Solutions:**\n• Try a different track\n• Check Railway networking policies\n• Verify FFmpeg installation`)
              ],
              ephemeral: true
            });
            return;
          }
        }
        
        queue.addTrack(track);
        
        console.log(`   Queue size after: ${queue.tracks.size}`);
        console.log(`   Queue is playing: ${queue.node.isPlaying()}`);
        console.log(`   Queue connection: ${queue.connection ? 'connected' : 'not connected'}`);
        
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#1DB954')
            .setDescription(`✅ Added **[${track.title}](${track.url})** to the queue`)
            .setThumbnail(track.thumbnail)
            .addFields(
              { name: '⏱️ Duration', value: this.musicManager.formatDuration(track.durationMS), inline: true },
              { name: '📊 Queue Position', value: `${queue.tracks.size}`, inline: true }
            )
          ]
        });
      }

      // Start playing if not already playing
      if (!queue.node.isPlaying()) {
        console.log(`▶️ [Music] Starting playback...`);
        console.log(`   Current track: ${queue.currentTrack?.title || 'none'}`);
        console.log(`   Queue size: ${queue.tracks.size}`);
        console.log(`   Connection status: ${queue.connection ? 'connected' : 'not connected'}`);
        
        try {
          // Get the track that should play
          const trackToPlay = queue.currentTrack || queue.tracks.at(0);
          if (trackToPlay) {
            console.log(`   Playing track: ${trackToPlay.title}`);
            console.log(`   Track URL: ${trackToPlay.url}`);
            console.log(`   Track duration: ${trackToPlay.durationMS}ms`);
            console.log(`   Track source: ${trackToPlay.source}`);
          }
          
          // Try to play the track with better error handling
          console.log(`🔍 [Music] Attempting to play track...`);
          console.log(`   Track URL: ${trackToPlay.url}`);
          console.log(`   Track source: ${trackToPlay.source}`);
          
          try {
            // CRITICAL: Check if player exists before trying to play
            // In discord-player v7, the player is created lazily when play() is called
            // But we need to ensure it exists before checking for resources
            console.log(`🔍 [Music] Checking player before play()...`);
            console.log(`   - queue.node.player: ${queue.node?.player ? 'exists' : 'missing'}`);
            
            if (!queue.node?.player) {
              console.warn(`⚠️ [Music] Player doesn't exist yet - it will be created by play()`);
              console.warn(`   This is normal for discord-player v7 (lazy initialization)`);
            }
            
            const playPromise = queue.node.play();
            
            // Wait for play to complete
            await playPromise;
            
            console.log(`✅ [Music] Playback started successfully`);
            
            // CRITICAL: Wait and verify playback is actually working
            // This catches "silent failures" where the stream is invalid
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            
            // Check if it's still playing after delay
            if (!queue.node.isPlaying()) {
              console.error(`❌ [Music] Playback terminated immediately`);
              console.error(`   This indicates the audio stream is invalid or empty`);
              console.error(`   Possible causes:`);
              console.error(`   - FFmpeg failed to process the stream`);
              console.error(`   - YouTube extractor returned invalid data`);
              console.error(`   - Network/CDN blocking on Railway`);
              console.error(`   - Missing audio codecs (libopus)`);
              
              // Try to get more info about the failure
              const playerState = queue.node?.player?.state || 'unknown';
              console.error(`   Player state: ${JSON.stringify(playerState)}`);
              
              await this.safeEditReply(interaction, {
                embeds: [new EmbedBuilder()
                  .setColor('#FF6B6B')
                  .setTitle('❌ Stream Extraction Failed')
                  .setDescription(`Could not extract audio from **${trackToPlay.title}**\n\nThe audio stream is invalid or empty.\n\n**Possible Solutions:**\n• Try a different track\n• Check Railway networking policies\n• Verify FFmpeg installation\n• Check emergency diagnostics in startup logs`)
                ]
              });
              
              throw new Error('Audio resource could not be processed. Stream validation failed.');
            }
            
            console.log(`✅ [Music] Playback verified - track is still playing after 2 seconds`);
          } catch (playError) {
            console.error(`❌ [Music] Error calling queue.node.play():`, playError);
            console.error(`   Error message: ${playError.message}`);
            console.error(`   Error stack: ${playError.stack}`);
            throw playError;
          }
          
          // Wait a bit and check if it's still playing
          setTimeout(() => {
            if (!queue.node.isPlaying()) {
              console.warn(`⚠️ [Music] Playback stopped immediately after starting`);
              console.warn(`   This usually means the audio resource couldn't be loaded`);
              console.warn(`   Possible causes:`);
              console.warn(`   - FFmpeg not working correctly`);
              console.warn(`   - Audio stream cannot be downloaded`);
              console.warn(`   - Voice connection issue`);
              console.warn(`   - Track URL is not accessible`);
            } else {
              console.log(`✅ [Music] Playback is still active after 2 seconds`);
            }
          }, 2000);
        } catch (playError) {
          console.error(`❌ [Music] Failed to start playback:`, playError);
          console.error(`   Error name: ${playError.name}`);
          console.error(`   Error message: ${playError.message}`);
          console.error(`   Error stack:`, playError.stack);
          try {
            await interaction.followUp({
              embeds: [new EmbedBuilder()
                .setColor('#FF6B6B')
                .setDescription(`❌ Failed to start playback: ${playError.message}`)
              ],
              ephemeral: true
            });
          } catch (replyError) {
            // Handle interaction timeout or already acknowledged errors
            if (replyError.code === 10062 || replyError.code === 40060 ||
                replyError.message?.includes('Unknown interaction') ||
                replyError.message?.includes('already been acknowledged')) {
              console.warn('⚠️ [Music] Interaction expired, cannot send error message');
            } else {
              console.error('❌ [Music] Failed to send error reply:', replyError);
            }
          }
        }
      } else {
        console.log(`⏸️ [Music] Already playing, track added to queue`);
      }
    } catch (error) {
      console.error('❌ [Music] Error in play command:', error);
      try {
        // Check if interaction is still valid before replying
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor('#FF6B6B')
              .setDescription(`❌ Error: ${error.message}`)
            ]
          });
        } else {
          await interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor('#FF6B6B')
              .setDescription(`❌ Error: ${error.message}`)
            ],
            ephemeral: true
          });
        }
      } catch (replyError) {
        // Handle interaction timeout or already acknowledged errors
        if (replyError.code === 10062 || replyError.code === 40060 ||
            replyError.message?.includes('Unknown interaction') ||
            replyError.message?.includes('already been acknowledged')) {
          console.warn('⚠️ [Music] Interaction expired, cannot send error message');
        } else {
          console.error('❌ [Music] Failed to send error reply:', replyError);
        }
      }
    }
  }

  /**
   * Handle pause command
   */
  async handlePause(interaction) {
    await interaction.deferReply();

    try {
      const queue = this.musicManager.player.nodes.get(interaction.guild.id);
      
      if (!queue || !queue.node.isPlaying()) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription('❌ Nothing is currently playing!')
          ]
        });
      }

      const paused = queue.node.pause();
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(paused ? '#FFA500' : '#1DB954')
          .setDescription(paused ? '⏸️ Paused the music' : '▶️ Resumed the music')
        ]
      });
    } catch (error) {
      console.error('❌ [Music] Error in pause command:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription(`❌ Error: ${error.message}`)
        ]
      });
    }
  }

  /**
   * Handle resume command
   */
  async handleResume(interaction) {
    await interaction.deferReply();

    try {
      const queue = this.musicManager.player.nodes.get(interaction.guild.id);
      
      if (!queue || !queue.node.isPlaying()) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription('❌ Nothing is currently playing!')
          ]
        });
      }

      const resumed = queue.node.resume();
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(resumed ? '#1DB954' : '#FFA500')
          .setDescription(resumed ? '▶️ Resumed the music' : '⏸️ Music is already playing')
        ]
      });
    } catch (error) {
      console.error('❌ [Music] Error in resume command:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription(`❌ Error: ${error.message}`)
        ]
      });
    }
  }

  /**
   * Handle skip command
   */
  async handleSkip(interaction) {
    await interaction.deferReply();

    try {
      const queue = this.musicManager.player.nodes.get(interaction.guild.id);
      
      if (!queue || !queue.currentTrack) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription('❌ Nothing is currently playing!')
          ]
        });
      }

      const amount = interaction.options.getInteger('amount') || 1;
      
      if (amount === 1) {
        queue.node.skip();
      } else {
        // Skip multiple tracks
        for (let i = 0; i < amount - 1; i++) {
          if (queue.tracks.size > 0) {
            queue.node.skip();
          }
        }
      }

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#1DB954')
          .setDescription(`⏭️ Skipped ${amount} track${amount !== 1 ? 's' : ''}`)
        ]
      });
    } catch (error) {
      console.error('❌ [Music] Error in skip command:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription(`❌ Error: ${error.message}`)
        ]
      });
    }
  }

  /**
   * Handle stop command
   */
  async handleStop(interaction) {
    await interaction.deferReply();

    try {
      const queue = this.musicManager.player.nodes.get(interaction.guild.id);
      
      if (!queue || !queue.currentTrack) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription('❌ Nothing is currently playing!')
          ]
        });
      }

      queue.delete();
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription('🛑 Stopped the music and cleared the queue')
        ]
      });
    } catch (error) {
      console.error('❌ [Music] Error in stop command:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription(`❌ Error: ${error.message}`)
        ]
      });
    }
  }

  /**
   * Handle queue command
   */
  async handleQueue(interaction) {
    await interaction.deferReply();

    try {
      const queue = this.musicManager.player.nodes.get(interaction.guild.id);
      const page = interaction.options.getInteger('page') || 1;

      if (!queue || !queue.currentTrack) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription('❌ No music is currently playing!')
          ]
        });
      }

      const description = this.musicManager.formatQueue(queue, page);
      const totalDuration = queue.tracks.reduce((acc, track) => acc + (track.durationMS || 0), 0) + (queue.currentTrack.durationMS || 0);

      const embed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle('🎵 Music Queue')
        .setDescription(description)
        .addFields(
          {
            name: '📊 Queue Stats',
            value: `Total tracks: ${queue.tracks.size + 1}\nTotal duration: ${this.musicManager.formatDuration(totalDuration)}`,
            inline: true
          },
          {
            name: '🔊 Volume',
            value: `${queue.node.volume}%`,
            inline: true
          },
          {
            name: '🔁 Loop',
            value: queue.repeatMode === 0 ? 'Off' : queue.repeatMode === 1 ? 'Track' : 'Queue',
            inline: true
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('❌ [Music] Error in queue command:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription(`❌ Error: ${error.message}`)
        ]
      });
    }
  }

  /**
   * Handle nowplaying command
   */
  async handleNowPlaying(interaction) {
    await interaction.deferReply();

    try {
      const queue = this.musicManager.player.nodes.get(interaction.guild.id);
      
      if (!queue || !queue.currentTrack) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription('❌ No music is currently playing!')
          ]
        });
      }

      const track = queue.currentTrack;
      const progress = queue.node.getTimestamp();
      const progressBar = this.createProgressBar(progress.current.value, progress.total.value);

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
            value: `${this.musicManager.formatDuration(progress.current.value)} / ${this.musicManager.formatDuration(progress.total.value)}`,
            inline: true
          },
          {
            name: '🔊 Volume',
            value: `${queue.node.volume}%`,
            inline: true
          },
          {
            name: '📊 Progress',
            value: progressBar,
            inline: false
          }
        )
        .setFooter({ text: `Queue: ${queue.tracks.size} track${queue.tracks.size !== 1 ? 's' : ''}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('❌ [Music] Error in nowplaying command:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription(`❌ Error: ${error.message}`)
        ]
      });
    }
  }

  /**
   * Handle volume command
   */
  async handleVolume(interaction) {
    await interaction.deferReply();

    try {
      const queue = this.musicManager.player.nodes.get(interaction.guild.id);
      
      if (!queue || !queue.currentTrack) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription('❌ No music is currently playing!')
          ]
        });
      }

      const volume = interaction.options.getInteger('amount');
      
      if (volume !== null) {
        queue.node.setVolume(volume);
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#1DB954')
            .setDescription(`🔊 Volume set to **${volume}%**`)
          ]
        });
      } else {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#1DB954')
            .setDescription(`🔊 Current volume: **${queue.node.volume}%**`)
          ]
        });
      }
    } catch (error) {
      console.error('❌ [Music] Error in volume command:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription(`❌ Error: ${error.message}`)
        ]
      });
    }
  }

  /**
   * Handle shuffle command
   */
  async handleShuffle(interaction) {
    await interaction.deferReply();

    try {
      const queue = this.musicManager.player.nodes.get(interaction.guild.id);
      
      if (!queue || queue.tracks.size === 0) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription('❌ Queue is empty!')
          ]
        });
      }

      queue.tracks.shuffle();
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#1DB954')
          .setDescription('🔀 Shuffled the queue')
        ]
      });
    } catch (error) {
      console.error('❌ [Music] Error in shuffle command:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription(`❌ Error: ${error.message}`)
        ]
      });
    }
  }

  /**
   * Handle remove command
   */
  async handleRemove(interaction) {
    await interaction.deferReply();

    try {
      const queue = this.musicManager.player.nodes.get(interaction.guild.id);
      const position = interaction.options.getInteger('position', true);
      
      if (!queue || queue.tracks.size === 0) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription('❌ Queue is empty!')
          ]
        });
      }

      if (position < 1 || position > queue.tracks.size) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription(`❌ Invalid position! Queue has ${queue.tracks.size} track${queue.tracks.size !== 1 ? 's' : ''}.`)
          ]
        });
      }

      const track = queue.tracks.at(position - 1);
      queue.removeTrack(track);

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#1DB954')
          .setDescription(`✅ Removed **[${track.title}](${track.url})** from the queue`)
        ]
      });
    } catch (error) {
      console.error('❌ [Music] Error in remove command:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription(`❌ Error: ${error.message}`)
        ]
      });
    }
  }

  /**
   * Handle clear command
   */
  async handleClear(interaction) {
    await interaction.deferReply();

    try {
      const queue = this.musicManager.player.nodes.get(interaction.guild.id);
      
      if (!queue || queue.tracks.size === 0) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription('❌ Queue is already empty!')
          ]
        });
      }

      const count = queue.tracks.size;
      queue.clear();

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#1DB954')
          .setDescription(`✅ Cleared **${count} track${count !== 1 ? 's' : ''}** from the queue`)
        ]
      });
    } catch (error) {
      console.error('❌ [Music] Error in clear command:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription(`❌ Error: ${error.message}`)
        ]
      });
    }
  }

  /**
   * Handle loop command
   */
  async handleLoop(interaction) {
    await interaction.deferReply();

    try {
      const queue = this.musicManager.player.nodes.get(interaction.guild.id);
      const mode = parseInt(interaction.options.getString('mode', true));
      
      if (!queue || !queue.currentTrack) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription('❌ No music is currently playing!')
          ]
        });
      }

      queue.setRepeatMode(mode);
      const modeText = mode === 0 ? 'Off' : mode === 1 ? 'Track' : 'Queue';

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#1DB954')
          .setDescription(`🔁 Loop mode set to **${modeText}**`)
        ]
      });
    } catch (error) {
      console.error('❌ [Music] Error in loop command:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription(`❌ Error: ${error.message}`)
        ]
      });
    }
  }

  /**
   * Handle seek command
   */
  async handleSeek(interaction) {
    await interaction.deferReply();

    try {
      const queue = this.musicManager.player.nodes.get(interaction.guild.id);
      const timeString = interaction.options.getString('time', true);
      
      if (!queue || !queue.currentTrack) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription('❌ No music is currently playing!')
          ]
        });
      }

      const timeMs = this.parseTimeString(timeString);
      if (isNaN(timeMs) || timeMs < 0) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription('❌ Invalid time format! Use format like "1:30" or "90s"')
          ]
        });
      }

      await queue.node.seek(timeMs);

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#1DB954')
          .setDescription(`⏩ Seeked to ${this.musicManager.formatDuration(timeMs)}`)
        ]
      });
    } catch (error) {
      console.error('❌ [Music] Error in seek command:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription(`❌ Error: ${error.message}`)
        ]
      });
    }
  }

  /**
   * Create progress bar
   */
  createProgressBar(current, total, length = 20) {
    const percentage = Math.min(current / total, 1);
    const filled = Math.round(length * percentage);
    const empty = length - filled;
    return `\`${'█'.repeat(filled)}${'░'.repeat(empty)}\` ${Math.round(percentage * 100)}%`;
  }

  /**
   * Parse time string to milliseconds
   */
  parseTimeString(timeString) {
    // Format: "1:30" or "90s" or "1m30s"
    const timeStr = timeString.toLowerCase().trim();
    
    // Handle seconds only (e.g., "90s" or "90")
    if (timeStr.endsWith('s') || /^\d+$/.test(timeStr)) {
      const seconds = parseInt(timeStr.replace('s', ''));
      return seconds * 1000;
    }
    
    // Handle MM:SS format
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      if (parts.length === 2) {
        const minutes = parseInt(parts[0]) || 0;
        const seconds = parseInt(parts[1]) || 0;
        return (minutes * 60 + seconds) * 1000;
      }
      if (parts.length === 3) {
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const seconds = parseInt(parts[2]) || 0;
        return (hours * 3600 + minutes * 60 + seconds) * 1000;
      }
    }
    
    // Handle "1m30s" format
    const minutesMatch = timeStr.match(/(\d+)m/);
    const secondsMatch = timeStr.match(/(\d+)s/);
    const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
    const seconds = secondsMatch ? parseInt(secondsMatch[1]) : 0;
    
    return (minutes * 60 + seconds) * 1000;
  }
}

module.exports = MusicCommands;


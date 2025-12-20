/**
 * Comcraft Twitter/X Monitor Manager
 * Monitor Twitter accounts and post new tweets to Discord channels
 * Uses RapidAPI Twitter API with tier-based check intervals
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const ConfigManager = require('../config-manager');

class TwitterMonitorManager {
  constructor(client) {
    this.client = client;
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.configManager = new ConfigManager();
    this.monitorIntervals = new Map(); // Store intervals per guild
    this.processedTweets = new Set(); // Cache to prevent duplicates
    this.guildCheckTimes = new Map(); // Track last check time per guild
  }

  /**
   * Start monitoring all configured Twitter accounts with tier-based intervals
   */
  startMonitoring() {
    console.log('🐦 Starting Twitter monitor with tier-based intervals...');
    
    // Check all monitors initially
    this.checkAllMonitors();
    
    // Set up interval to check monitors (runs every minute, but respects per-guild intervals)
    this.globalInterval = setInterval(() => {
      this.checkAllMonitors();
    }, 60 * 1000); // Check every minute

    console.log('✅ Twitter monitor started with dynamic tier-based intervals');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.globalInterval) {
      clearInterval(this.globalInterval);
      this.globalInterval = null;
      console.log('🛑 Twitter monitor stopped');
    }
  }

  /**
   * Add Twitter monitor for a guild
   */
  async addMonitor(guildId, channelId, twitterUsername, options = {}) {
    try {
      // Validate Twitter username format
      const cleanUsername = twitterUsername.replace('@', '').trim();
      
      // Check if already exists
      const { data: existing } = await this.supabase
        .from('twitter_monitors')
        .select('id')
        .eq('guild_id', guildId)
        .eq('twitter_username', cleanUsername)
        .single();

      if (existing) {
        return { success: false, error: 'This Twitter account is already being monitored' };
      }

      // Insert new monitor
      const { data, error } = await this.supabase
        .from('twitter_monitors')
        .insert({
          guild_id: guildId,
          channel_id: channelId,
          twitter_username: cleanUsername,
          enabled: options.enabled ?? true,
          include_retweets: options.includeRetweets ?? false,
          include_replies: options.includeReplies ?? false,
          notification_message: options.notificationMessage || null,
          mention_role_id: options.mentionRoleId || null
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Added Twitter monitor for @${cleanUsername} in guild ${guildId}`);
      return { success: true, monitor: data };
    } catch (error) {
      console.error('Error adding Twitter monitor:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove Twitter monitor
   */
  async removeMonitor(monitorId, guildId) {
    try {
      const { error } = await this.supabase
        .from('twitter_monitors')
        .delete()
        .eq('id', monitorId)
        .eq('guild_id', guildId);

      if (error) throw error;

      console.log(`🗑️ Removed Twitter monitor ${monitorId}`);
      return { success: true };
    } catch (error) {
      console.error('Error removing Twitter monitor:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all monitors for a guild
   */
  async getGuildMonitors(guildId) {
    try {
      const { data, error } = await this.supabase
        .from('twitter_monitors')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, monitors: data || [] };
    } catch (error) {
      console.error('Error getting guild monitors:', error);
      return { success: false, monitors: [] };
    }
  }

  /**
   * Update monitor settings
   */
  async updateMonitor(monitorId, guildId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('twitter_monitors')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', monitorId)
        .eq('guild_id', guildId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, monitor: data };
    } catch (error) {
      console.error('Error updating monitor:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check all monitors for new tweets
   */
  async checkAllMonitors() {
    try {
      // Get all enabled monitors
      const { data: monitors, error } = await this.supabase
        .from('twitter_monitors')
        .select('*')
        .eq('enabled', true);

      if (error) {
        if (error.code === '42P01') return; // Table doesn't exist
        throw error;
      }
      if (!monitors || monitors.length === 0) {
        return; // Silent when no monitors
      }

      // Group monitors by guild to check intervals
      const guildMonitors = {};
      for (const monitor of monitors) {
        if (!guildMonitors[monitor.guild_id]) {
          guildMonitors[monitor.guild_id] = [];
        }
        guildMonitors[monitor.guild_id].push(monitor);
      }

      // Check each guild's monitors based on their tier interval
      for (const [guildId, guildMonitorList] of Object.entries(guildMonitors)) {
        // Get guild's check interval from subscription tier
        const limits = await this.configManager.getSubscriptionLimits(guildId);
        const checkIntervalMinutes = limits.twitter_check_interval || 120; // Default 2 hours
        const checkIntervalMs = checkIntervalMinutes * 60 * 1000;

        // Check if enough time has passed since last check
        const lastCheckTime = this.guildCheckTimes.get(guildId) || 0;
        const timeSinceLastCheck = Date.now() - lastCheckTime;

        if (timeSinceLastCheck < checkIntervalMs) {
          // Not time to check yet
          continue;
        }

        // Time to check this guild's monitors!
        console.log(`\n🐦 ========== TWITTER: Checking guild ${guildId} (${guildMonitorList.length} monitor(s), interval: ${checkIntervalMinutes} min) ==========`);
        
        for (const monitor of guildMonitorList) {
          console.log(`🐦 [TWITTER] Checking @${monitor.twitter_username}...`);
          await this.checkMonitor(monitor);
          // Small delay between checks
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Update last check time for this guild
        this.guildCheckTimes.set(guildId, Date.now());
        console.log(`🐦 ========== TWITTER: Guild ${guildId} check complete ==========\n`);
      }
    } catch (error) {
      console.error('🐦 [TWITTER] ❌ Error checking all monitors:', error);
    }
  }

  /**
   * Check a specific monitor for new tweets
   */
  async checkMonitor(monitor) {
    try {
      // Get subscription limits for this guild
      const { data: config } = await this.supabase
        .from('guild_configs')
        .select('subscription_tier')
        .eq('guild_id', monitor.guild_id)
        .single();

      const tier = config?.subscription_tier || 'free';
      
      // Get limits from subscription_tiers table
      const { data: tierData } = await this.supabase
        .from('subscription_tiers')
        .select('limits')
        .eq('tier_name', tier)
        .eq('is_active', true)
        .single();

      // Fallback tweet count per tier
      const fallbackTweetCounts = {
        free: 5,
        basic: 10,
        premium: 25,
        enterprise: 50
      };

      const maxTweets = tierData?.limits?.twitter_tweets_per_check ?? fallbackTweetCounts[tier] ?? 10;
      
      console.log(`🐦 [TWITTER] 📊 Tier: ${tier}, Max tweets per check: ${maxTweets}`);

      // Fetch latest tweets from Twitter
      const tweets = await this.fetchUserTweets(monitor.twitter_username, {
        includeRetweets: monitor.include_retweets,
        includeReplies: monitor.include_replies,
        maxTweets: maxTweets
      });

      if (!tweets || tweets.length === 0) {
        console.log(`🐦 [TWITTER] ⚠️ No tweets found for @${monitor.twitter_username}`);
        return;
      }

      console.log(`🐦 [TWITTER] 📝 Found ${tweets.length} tweets for @${monitor.twitter_username}`);

      // Get last processed tweet timestamp
      const lastCheck = monitor.last_tweet_at ? new Date(monitor.last_tweet_at) : null;
      let newestTweetTime = lastCheck;

      // Process tweets (newest first)
      let newTweetsPosted = 0;
      for (const tweet of tweets) {
        const tweetTime = new Date(tweet.created_at);
        
        // Skip if older than last check (silent)
        if (lastCheck && tweetTime <= lastCheck) {
          continue;
        }
        
        // Skip if already processed (silent)
        const tweetId = tweet.id_str || tweet.id;
        if (this.processedTweets.has(tweetId)) {
          continue;
        }

        // Post to Discord
        console.log(`🐦 [TWITTER] 📤 Posting NEW tweet from @${monitor.twitter_username} to Discord...`);
        await this.postTweetToDiscord(monitor, tweet);
        newTweetsPosted++;
        
        // Mark as processed
        this.processedTweets.add(tweetId);
        
        // Update newest time
        if (!newestTweetTime || tweetTime > newestTweetTime) {
          newestTweetTime = tweetTime;
        }

        // Small delay between posts
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (newTweetsPosted > 0) {
        console.log(`🐦 [TWITTER] ✅ Successfully posted ${newTweetsPosted} new tweet(s) for @${monitor.twitter_username}`);
      }

      // Update last check timestamp
      if (newestTweetTime && newestTweetTime !== lastCheck) {
        await this.supabase
          .from('twitter_monitors')
          .update({ 
            last_tweet_at: newestTweetTime.toISOString(),
            last_check_at: new Date().toISOString()
          })
          .eq('id', monitor.id);
      }

      // Clean up old processed tweets from cache (keep last 1000)
      if (this.processedTweets.size > 1000) {
        const entries = Array.from(this.processedTweets);
        this.processedTweets = new Set(entries.slice(-500));
      }
    } catch (error) {
      console.error(`Error checking monitor ${monitor.id} (@${monitor.twitter_username}):`, error);
    }
  }

  /**
   * Fetch tweets from Twitter/X account via RapidAPI
   * Uses RapidAPI Twitter API (same key as TikTok!)
   */
  async fetchUserTweets(username, options = {}) {
    console.log(`🐦 [TWITTER] 🔍 Fetching tweets for @${username}...`);
    
    if (!process.env.RAPIDAPI_KEY) {
      console.error(`🐦 [TWITTER] ❌ RAPIDAPI_KEY not configured`);
      return [];
    }

    try {
      const cleanUsername = username.replace('@', '');
      const maxTweets = options.maxTweets || 10;
      
      console.log(`🐦 [TWITTER] 📡 Using RapidAPI Twitter API...`);
      
      // RapidAPI Twitter API endpoint
      const response = await axios.get(
        `https://twitter-api45.p.rapidapi.com/timeline.php`,
        {
          params: {
            screenname: cleanUsername,
            count: maxTweets
          },
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'twitter-api45.p.rapidapi.com'
          },
          timeout: 10000
        }
      );

      if (!response.data || !response.data.timeline) {
        console.log(`🐦 [TWITTER] ⚠️ No tweets found in response for @${cleanUsername}`);
        return [];
      }

      // Parse tweets from response
      let tweets = response.data.timeline.map(tweet => {
        const isRetweet = tweet.retweeted || tweet.text?.startsWith('RT @');
        const isReply = tweet.in_reply_to_screen_name || tweet.in_reply_to_status_id;

        return {
          id_str: tweet.tweet_id || tweet.id_str,
          id: tweet.tweet_id || tweet.id_str,
          text: tweet.text || '',
          created_at: tweet.created_at,
          user: {
            screen_name: tweet.author?.screen_name || cleanUsername,
            name: tweet.author?.name || cleanUsername,
            profile_image_url_https: tweet.author?.avatar
          },
          entities: {
            urls: tweet.entities?.urls || [],
            media: tweet.entities?.media || []
          },
          url: `https://twitter.com/${cleanUsername}/status/${tweet.tweet_id || tweet.id_str}`,
          is_retweet: isRetweet,
          in_reply_to_screen_name: isReply ? (tweet.in_reply_to_screen_name || 'someone') : null
        };
      });

      // Filter based on options
      if (!options.includeRetweets) {
        tweets = tweets.filter(t => !t.is_retweet);
      }
      if (!options.includeReplies) {
        tweets = tweets.filter(t => !t.in_reply_to_screen_name);
      }

      console.log(`🐦 [TWITTER] ✅ RapidAPI returned ${tweets.length} tweets (after filters)`);
      return tweets;
    } catch (error) {
      if (error.response?.status === 429) {
        console.error(`🐦 [TWITTER] ❌ Rate limit exceeded (429). Upgrade your RapidAPI plan!`);
      } else {
        console.error(`🐦 [TWITTER] ❌ RapidAPI failed: ${error.message}`);
      }
      return [];
    }
  }

  /**
   * Fetch tweets via official Twitter API v2
   * Requires TWITTER_BEARER_TOKEN environment variable
   */
  async fetchTweetsViaTwitterAPIv2(username, options = {}) {
    try {
      // Step 1: Get user ID from username
      const userResponse = await axios.get(
        `https://api.twitter.com/2/users/by/username/${username}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
          },
          timeout: 10000
        }
      );

      if (!userResponse.data || !userResponse.data.data || !userResponse.data.data.id) {
        throw new Error('User not found');
      }

      const userId = userResponse.data.data.id;

      // Step 2: Get user's tweets
      const maxTweets = Math.min(options.maxTweets || 10, 100); // Twitter API max is 100
      const tweetsResponse = await axios.get(
        `https://api.twitter.com/2/users/${userId}/tweets`,
        {
          params: {
            max_results: maxTweets,
            'tweet.fields': 'created_at,author_id,text,referenced_tweets,attachments',
            'expansions': 'attachments.media_keys,author_id',
            'media.fields': 'url,preview_image_url,type',
            'user.fields': 'name,username,profile_image_url'
          },
          headers: {
            'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
          },
          timeout: 10000
        }
      );

      if (!tweetsResponse.data || !tweetsResponse.data.data) {
        return [];
      }

      const tweets = tweetsResponse.data.data;
      const includes = tweetsResponse.data.includes || {};
      const users = includes.users || [];
      const media = includes.media || [];

      // Convert to standard format
      let formattedTweets = tweets.map(tweet => {
        const author = users.find(u => u.id === tweet.author_id);
        const isRetweet = tweet.referenced_tweets?.some(ref => ref.type === 'retweeted');
        const isReply = tweet.referenced_tweets?.some(ref => ref.type === 'replied_to');

        // Get media
        let tweetMedia = null;
        if (tweet.attachments && tweet.attachments.media_keys && tweet.attachments.media_keys.length > 0) {
          const mediaKey = tweet.attachments.media_keys[0];
          tweetMedia = media.find(m => m.media_key === mediaKey);
        }

        return {
          id_str: tweet.id,
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at,
          user: {
            screen_name: author?.username || username,
            name: author?.name || username,
            profile_image_url_https: author?.profile_image_url || null
          },
          entities: {
            urls: [],
            media: tweetMedia ? [{
              type: tweetMedia.type,
              media_url_https: tweetMedia.url || tweetMedia.preview_image_url
            }] : []
          },
          url: `https://twitter.com/${username}/status/${tweet.id}`,
          is_retweet: isRetweet,
          in_reply_to_screen_name: isReply ? 'someone' : null
        };
      });

      // Filter based on options
      if (!options.includeRetweets) {
        formattedTweets = formattedTweets.filter(t => !t.is_retweet);
      }
      if (!options.includeReplies) {
        formattedTweets = formattedTweets.filter(t => !t.in_reply_to_screen_name);
      }

      return formattedTweets;
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.detail || error.response.data?.error || 'Unknown error';
        
        if (status === 401) {
          throw new Error('Invalid Twitter API Bearer Token');
        } else if (status === 429) {
          throw new Error('Twitter API rate limit exceeded');
        } else {
          throw new Error(`Twitter API HTTP ${status}: ${message}`);
        }
      }
      throw new Error(`Twitter API request failed: ${error.message}`);
    }
  }

  /**
   * Fetch tweets via RapidAPI (DEPRECATED - not used)
   */
  async fetchTweetsViaRapidAPI(username, options = {}) {
    try {
      const maxTweets = options.maxTweets || 10;
      const response = await axios.get('https://twitter-api45.p.rapidapi.com/timeline.php', {
        params: {
          screenname: username,
          count: maxTweets
        },
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'twitter-api45.p.rapidapi.com'
        },
        timeout: 5000 // Reduced timeout to 5s for faster fallback
      });

      if (!response.data || !response.data.timeline) {
        throw new Error('Invalid API response');
      }

      let tweets = response.data.timeline;

      // Filter retweets if needed
      if (!options.includeRetweets) {
        tweets = tweets.filter(t => !t.text.startsWith('RT @'));
      }

      // Filter replies if needed
      if (!options.includeReplies) {
        tweets = tweets.filter(t => !t.in_reply_to_screen_name);
      }

      return tweets;
    } catch (error) {
      // Log detailed error for debugging
      if (error.response) {
        console.error(`RapidAPI Error: Status ${error.response.status}`);
        if (error.response.status === 429) {
          console.error('⚠️ RapidAPI quota exceeded - using free Nitter fallback');
        }
        throw new Error(`RapidAPI HTTP ${error.response.status}: ${error.response.data?.message || 'Unknown error'}`);
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('RapidAPI timeout - trying fallback');
      } else {
        throw new Error(`RapidAPI fetch failed: ${error.message}`);
      }
    }
  }

  /**
   * Fetch tweets via Nitter RSS (fallback method)
   */
  async fetchTweetsViaNitter(username, options = {}) {
    try {
      const Parser = require('rss-parser');
      const parser = new Parser({
        timeout: 15000, // Increased timeout to 15s
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      // Use multiple Nitter instances as fallbacks
      // Note: Nitter instances are frequently blocked by Twitter/X
      const nitterInstances = [
        'nitter.poast.org',
        'nitter.privacydev.net',
        'nitter.net',
        'nitter.unixfox.eu',
        'nitter.cz',
        'nitter.kavin.rocks',
        'nitter.fdn.fr',
        'nitter.1d4.us',
        'nitter.nixnet.services'
      ];

      for (const instance of nitterInstances) {
        try {
          const feed = await parser.parseURL(`https://${instance}/${username}/rss`);
          
          if (!feed || !feed.items || feed.items.length === 0) continue;

          // Convert RSS items to tweet format
          const tweets = feed.items.map(item => {
            const isRetweet = item.title && item.title.startsWith('RT by @');
            const isReply = item.title && item.title.includes('R to @');

            return {
              id_str: item.guid || item.link.split('/').pop(),
              id: item.guid || item.link.split('/').pop(),
              text: item.title || item.contentSnippet || '',
              created_at: item.pubDate || item.isoDate,
              user: {
                screen_name: username,
                name: feed.title ? feed.title.replace(` / Twitter`, '').replace(`(@${username})`, '').trim() : username
              },
              entities: {
                urls: [],
                media: []
              },
              url: item.link,
              is_retweet: isRetweet,
              in_reply_to_screen_name: isReply ? 'someone' : null
            };
          });

          // Filter based on options
          let filtered = tweets;
          if (!options.includeRetweets) {
            filtered = filtered.filter(t => !t.is_retweet);
          }
          if (!options.includeReplies) {
            filtered = filtered.filter(t => !t.in_reply_to_screen_name);
          }

          // Limit number of tweets based on subscription tier
          const maxTweets = options.maxTweets || 10;
          filtered = filtered.slice(0, maxTweets);

          console.log(`🐦 [TWITTER] ✅ Success! Fetched ${filtered.length} tweets from ${instance} (limited to ${maxTweets})`);
          return filtered;
        } catch (err) {
          console.log(`🐦 [TWITTER] ⚠️ Instance ${instance} failed, trying next...`);
          continue;
        }
      }

      throw new Error('All Nitter instances failed');
    } catch (error) {
      throw new Error(`Nitter fetch failed: ${error.message}`);
    }
  }

  /**
   * Post tweet to Discord channel
   */
  async postTweetToDiscord(monitor, tweet) {
    try {
      const channel = await this.client.channels.fetch(monitor.channel_id);
      if (!channel || !channel.isTextBased()) {
        console.error(`Channel ${monitor.channel_id} not found or not text-based`);
        return;
      }

      const username = tweet.user?.screen_name || monitor.twitter_username;
      const displayName = tweet.user?.name || username;
      const tweetText = tweet.text || tweet.title || '';
      const tweetUrl = tweet.url || `https://twitter.com/${username}/status/${tweet.id_str || tweet.id}`;

      // Build embed
      const embed = new EmbedBuilder()
        .setColor('#1DA1F2') // Twitter blue
        .setAuthor({
          name: `${displayName} (@${username})`,
          iconURL: tweet.user?.profile_image_url_https || `https://unavatar.io/twitter/${username}`,
          url: `https://twitter.com/${username}`
        })
        .setDescription(tweetText.length > 4096 ? tweetText.substring(0, 4090) + '...' : tweetText)
        .setTimestamp(new Date(tweet.created_at))
        .setFooter({ text: '🐦 Twitter/X' });

      // Add tweet link
      embed.setURL(tweetUrl);

      // Add media if available
      if (tweet.entities?.media && tweet.entities.media.length > 0) {
        const media = tweet.entities.media[0];
        if (media.type === 'photo' && media.media_url_https) {
          embed.setImage(media.media_url_https);
        }
      }

      // Build message content
      let content = '';
      
      // Add custom notification message
      if (monitor.notification_message) {
        content += monitor.notification_message + '\n';
      }
      
      // Add role mention
      if (monitor.mention_role_id) {
        content += `<@&${monitor.mention_role_id}> `;
      }

      // Add tweet link as clickable
      content += `\n${tweetUrl}`;

      // Send to Discord
      await channel.send({
        content: content.trim() || tweetUrl,
        embeds: [embed]
      });

      console.log(`🐦 [TWITTER] ✅ Tweet posted from @${username} to #${channel.name}`);
    } catch (error) {
      console.error('🐦 [TWITTER] ❌ Error posting tweet to Discord:', error);
    }
  }
}

module.exports = TwitterMonitorManager;

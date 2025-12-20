/**
 * Comcraft Twitter/X Monitor Manager
 * Monitor Twitter accounts and post new tweets to Discord channels
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

class TwitterMonitorManager {
  constructor(client) {
    this.client = client;
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.monitorInterval = null;
    this.checkIntervalMs = 2 * 60 * 1000; // Check every 2 minutes
    this.processedTweets = new Set(); // Cache to prevent duplicates
  }

  /**
   * Start monitoring all configured Twitter accounts
   */
  startMonitoring() {
    if (this.monitorInterval) {
      console.log('⚠️ Twitter monitor already running');
      return;
    }

    console.log('🐦 Starting Twitter monitor...');
    
    // Initial check
    this.checkAllMonitors();
    
    // Set up interval
    this.monitorInterval = setInterval(() => {
      this.checkAllMonitors();
    }, this.checkIntervalMs);

    console.log('✅ Twitter monitor started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
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

      if (error) throw error;
      if (!monitors || monitors.length === 0) {
        return; // Silent when no monitors
      }

      console.log(`\n🐦 ========== TWITTER MONITOR: Checking ${monitors.length} account(s) ==========`);

      // Check each monitor
      for (const monitor of monitors) {
        console.log(`🐦 [TWITTER] Checking @${monitor.twitter_username}...`);
        await this.checkMonitor(monitor);
        // Small delay between checks to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log(`🐦 ========== TWITTER MONITOR: Check complete ==========\n`);
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
   * Fetch tweets from Twitter/X account
   * Uses RSS.app as primary method
   */
  async fetchUserTweets(username, options = {}) {
    console.log(`🐦 [TWITTER] 🔍 Fetching tweets for @${username}...`);
    
    // Primary: Use RSS.app (reliable and affordable)
    console.log(`🐦 [TWITTER] 📡 Using RSS.app...`);
    try {
      const tweets = await this.fetchTweetsViaRSSApp(username, options);
      console.log(`🐦 [TWITTER] ✅ RSS.app returned ${tweets.length} tweets`);
      return tweets;
    } catch (error) {
      console.error(`🐦 [TWITTER] ❌ RSS.app failed: ${error.message}`);
      console.log(`🐦 [TWITTER] 🔄 Falling back to Nitter RSS...`);
    }
    
    // Fallback to Nitter RSS (unreliable but free)
    try {
      const tweets = await this.fetchTweetsViaNitter(username, options);
      console.log(`🐦 [TWITTER] ✅ Nitter returned ${tweets.length} tweets`);
      return tweets;
    } catch (error) {
      console.error(`🐦 [TWITTER] ❌ All methods failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch tweets via RSS.app
   * Requires RSSAPP_API_KEY environment variable
   */
  async fetchTweetsViaRSSApp(username, options = {}) {
    try {
      const cleanUsername = username.replace('@', '');
      const maxTweets = options.maxTweets || 10;
      
      // RSS.app API endpoint
      // Format: https://rss.app/feeds/[feed_id].json or RSS endpoint
      const apiKey = process.env.RSSAPP_API_KEY;
      
      if (!apiKey) {
        throw new Error('RSSAPP_API_KEY not configured');
      }

      // Create or get RSS feed for this Twitter account
      // RSS.app format: twitter/username
      const feedResponse = await axios.get(
        `https://rss.app/api/v1/feeds`,
        {
          params: {
            url: `https://twitter.com/${cleanUsername}`,
            api_key: apiKey
          },
          timeout: 10000
        }
      );

      if (!feedResponse.data || !feedResponse.data.feed_url) {
        throw new Error('Failed to get RSS feed from RSS.app');
      }

      // Fetch the RSS feed
      const Parser = require('rss-parser');
      const parser = new Parser({
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const feed = await parser.parseURL(feedResponse.data.feed_url);

      if (!feed || !feed.items || feed.items.length === 0) {
        throw new Error('RSS feed is empty');
      }

      // Convert RSS items to tweet format
      let tweets = feed.items.map(item => {
        const isRetweet = item.title && (item.title.startsWith('RT @') || item.title.startsWith('RT by @'));
        const isReply = item.title && item.title.includes('Replying to @');

        return {
          id_str: item.guid || item.link?.split('/').pop() || Date.now().toString(),
          id: item.guid || item.link?.split('/').pop() || Date.now().toString(),
          text: item.title || item.contentSnippet || '',
          created_at: item.pubDate || item.isoDate || new Date().toISOString(),
          user: {
            screen_name: cleanUsername,
            name: feed.title ? feed.title.split('(')[0].trim() : cleanUsername,
            profile_image_url_https: null
          },
          entities: {
            urls: [],
            media: []
          },
          url: item.link || `https://twitter.com/${cleanUsername}`,
          is_retweet: isRetweet,
          in_reply_to_screen_name: isReply ? 'someone' : null
        };
      });

      // Filter based on options
      if (!options.includeRetweets) {
        tweets = tweets.filter(t => !t.is_retweet);
      }
      if (!options.includeReplies) {
        tweets = tweets.filter(t => !t.in_reply_to_screen_name);
      }

      // Limit to max tweets
      tweets = tweets.slice(0, maxTweets);

      return tweets;
    } catch (error) {
      throw new Error(`RSS.app fetch failed: ${error.message}`);
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

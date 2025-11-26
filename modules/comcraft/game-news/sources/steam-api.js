/**
 * Steam API Source
 * Fetches news for Steam games (CS2, Dota 2, etc.)
 */

const axios = require('axios');

class SteamSource {
  constructor(appId) {
    this.appId = appId; // Steam App ID (730 for CS2)
    this.baseUrl = 'http://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/';
  }

  /**
   * Fetch latest news
   */
  async fetchLatestNews() {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          appid: this.appId,
          count: 10,
          maxlength: 300,
          format: 'json',
        },
        timeout: 10000,
      });

      const newsItems = response.data?.appnews?.newsitems || [];

      return newsItems.slice(0, 5).map(item => ({
        externalId: `steam_${this.appId}_${item.gid}`,
        title: item.title,
        content: this.cleanContent(item.contents),
        url: item.url,
        imageUrl: this.extractImage(item),
        thumbnailUrl: null,
        type: this.detectType(item),
        publishedAt: new Date(item.date * 1000).toISOString(), // Unix timestamp
        metadata: {
          author: item.author,
          feedlabel: item.feedlabel,
          feed_type: item.feed_type,
        },
      }));
    } catch (error) {
      console.error(`[Steam ${this.appId}] Error fetching news:`, error.message);
      return [];
    }
  }

  /**
   * Clean content (remove BB codes and HTML)
   */
  cleanContent(content) {
    if (!content) return '';
    
    return content
      .replace(/\[.*?\]/g, '') // Remove BB codes [img], [url], etc.
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 300); // Limit length
  }

  /**
   * Try to extract image from content
   */
  extractImage(item) {
    if (!item.contents) return null;
    
    // Try to find image URL in content
    // Steam often includes images as [img]URL[/img] or direct URLs
    const imgMatch = item.contents.match(/\[img\](https?:\/\/[^\]]+)\[\/img\]/i) ||
                     item.contents.match(/(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif))/i);
    
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
    
    return null;
  }

  /**
   * Detect news type
   */
  detectType(item) {
    const title = (item.title || '').toLowerCase();
    const feedLabel = (item.feedlabel || '').toLowerCase();
    
    if (title.includes('update') || title.includes('patch') || feedLabel.includes('patch')) {
      return 'patch';
    }
    if (title.includes('hotfix')) {
      return 'hotfix';
    }
    if (title.includes('event') || feedLabel.includes('event')) {
      return 'event';
    }
    if (title.includes('maintenance') || title.includes('downtime')) {
      return 'maintenance';
    }
    
    // Product Updates are usually patches
    if (item.feed_type === 0 || feedLabel.includes('product')) {
      return 'patch';
    }
    
    return 'news';
  }
}

module.exports = SteamSource;


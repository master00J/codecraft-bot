/**
 * Fortnite API Source
 * Fetches news using Fortnite-API.com
 */

const axios = require('axios');

class FortniteSource {
  constructor() {
    this.baseUrl = 'https://fortnite-api.com/v2';
    this.apiKey = process.env.FORTNITE_API_KEY || null; // Optional, for higher rate limits
  }

  /**
   * Fetch latest news
   */
  async fetchLatestNews() {
    try {
      const headers = {};
      if (this.apiKey) {
        headers['Authorization'] = this.apiKey;
      }

      // Fetch Battle Royale news
      const response = await axios.get(`${this.baseUrl}/news/br`, {
        headers,
        timeout: 10000,
      });

      const newsData = response.data?.data;
      if (!newsData) return [];

      const newsItems = [];

      // Game mode messages (main news)
      if (newsData.motds) {
        for (const motd of newsData.motds) {
          newsItems.push({
            externalId: `motd_${motd.id}`,
            title: motd.title || 'Fortnite News',
            content: motd.body || '',
            url: 'https://www.fortnite.com/news',
            imageUrl: motd.image || null,
            thumbnailUrl: motd.tileImage || null,
            type: this.detectType(motd),
            publishedAt: new Date().toISOString(), // Fortnite API doesn't provide dates
            metadata: {
              id: motd.id,
              tabTitle: motd.tabTitle,
            },
          });
        }
      }

      // Add shop news if available
      if (newsData.news && newsData.news.messages) {
        for (const message of newsData.news.messages.slice(0, 3)) {
          newsItems.push({
            externalId: `news_${message.adspace}`,
            title: message.title || 'Shop Update',
            content: message.body || '',
            url: 'https://www.fortnite.com',
            imageUrl: message.image || null,
            thumbnailUrl: null,
            type: 'news',
            publishedAt: new Date().toISOString(),
            metadata: {
              adspace: message.adspace,
            },
          });
        }
      }

      return newsItems.slice(0, 5);
    } catch (error) {
      console.error('[Fortnite] Error fetching news:', error.message);
      return [];
    }
  }

  /**
   * Detect news type
   */
  detectType(motd) {
    const title = (motd.title || '').toLowerCase();
    const body = (motd.body || '').toLowerCase();
    
    if (title.includes('update') || body.includes('patch')) {
      return 'patch';
    }
    if (title.includes('event') || body.includes('event')) {
      return 'event';
    }
    if (title.includes('maintenance') || body.includes('downtime')) {
      return 'maintenance';
    }
    if (title.includes('shop') || title.includes('item')) {
      return 'news';
    }
    
    return 'news';
  }
}

module.exports = FortniteSource;


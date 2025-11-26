/**
 * Riot Games API Source
 * Fetches news for League of Legends and Valorant
 * Uses Community Dragon for LOL and PlayValorant for Valorant
 */

const axios = require('axios');

class RiotSource {
  constructor(game) {
    this.game = game; // 'lol' or 'valorant'
    this.lastCheck = null;
  }

  /**
   * Fetch latest news
   */
  async fetchLatestNews() {
    if (this.game === 'lol') {
      return this.fetchLolNews();
    } else if (this.game === 'valorant') {
      return this.fetchValorantNews();
    }
    return [];
  }

  /**
   * Fetch League of Legends news
   * Uses official League of Legends RSS feed
   */
  async fetchLolNews() {
    try {
      // Use RSS feed as primary source (more reliable)
      return this.fetchLolRssFallback();
    } catch (error) {
      console.error('[LOL] Error fetching news:', error.message);
      return [];
    }
  }

  /**
   * Fallback RSS parser for LOL
   */
  async fetchLolRssFallback() {
    try {
      const Parser = require('rss-parser');
      const parser = new Parser();
      
      // Try multiple RSS feeds
      const rssUrls = [
        'https://www.leagueoflegends.com/en-us/news/rss.xml',
        'https://www.leagueoflegends.com/en-gb/news/rss.xml',
      ];

      for (const rssUrl of rssUrls) {
        try {
          const feed = await parser.parseURL(rssUrl);
          
          if (feed.items && feed.items.length > 0) {
            return feed.items.slice(0, 5).map(item => ({
              externalId: item.guid || item.link || `lol-${Date.now()}-${Math.random()}`,
              title: item.title,
              content: item.contentSnippet || item.content || '',
              url: item.link,
              imageUrl: item.enclosure?.url || null,
              thumbnailUrl: null,
              type: 'news',
              publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
              metadata: {
                categories: item.categories || [],
              },
            }));
          }
        } catch (err) {
          console.log(`[LOL] Failed to fetch from ${rssUrl}:`, err.message);
          continue;
        }
      }

      console.warn('[LOL] All RSS feeds failed');
      return [];
    } catch (error) {
      console.error('[LOL] RSS fallback failed:', error.message);
      return [];
    }
  }

  /**
   * Detect news type for LOL
   */
  detectLolType(article) {
    const title = (article.title || '').toLowerCase();
    const category = (article.category?.title || '').toLowerCase();
    
    if (title.includes('patch') || category.includes('patch')) {
      return 'patch';
    }
    if (title.includes('hotfix') || category.includes('hotfix')) {
      return 'hotfix';
    }
    if (title.includes('event') || category.includes('event')) {
      return 'event';
    }
    if (title.includes('maintenance')) {
      return 'maintenance';
    }
    
    return 'news';
  }

  /**
   * Fetch Valorant news
   * Uses official Valorant RSS feed
   */
  async fetchValorantNews() {
    try {
      // Use RSS feed as primary source (more reliable)
      return this.fetchValorantRssFallback();
    } catch (error) {
      return [];
    }
  }

  /**
   * Fallback RSS parser for Valorant
   */
  async fetchValorantRssFallback() {
    try {
      const Parser = require('rss-parser');
      const parser = new Parser();
      
      // Try multiple RSS feeds
      const rssUrls = [
        'https://playvalorant.com/en-us/news/rss/',
        'https://playvalorant.com/en-gb/news/rss/',
      ];

      for (const rssUrl of rssUrls) {
        try {
          const feed = await parser.parseURL(rssUrl);
          
          if (feed.items && feed.items.length > 0) {
            return feed.items.slice(0, 5).map(item => ({
              externalId: item.guid || item.link || `valorant-${Date.now()}-${Math.random()}`,
              title: item.title,
              content: item.contentSnippet || '',
              url: item.link,
              imageUrl: item.enclosure?.url || null,
              thumbnailUrl: null,
              type: 'news',
              publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
              metadata: {
                categories: item.categories || [],
              },
            }));
          }
        } catch (err) {
          continue;
        }
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Detect news type for Valorant
   */
  detectValorantType(article) {
    const title = (article.title || '').toLowerCase();
    const category = (article.category || '').toLowerCase();
    
    if (title.includes('patch') || category.includes('patch')) {
      return 'patch';
    }
    if (title.includes('agent') || title.includes('map')) {
      return 'patch';
    }
    if (title.includes('event') || category.includes('event')) {
      return 'event';
    }
    if (title.includes('maintenance')) {
      return 'maintenance';
    }
    
    return 'news';
  }
}

module.exports = RiotSource;


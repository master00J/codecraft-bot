/**
 * Minecraft RSS Source
 * Fetches news from official Minecraft blog
 */

const Parser = require('rss-parser');

class MinecraftSource {
  constructor() {
    this.parser = new Parser({
      customFields: {
        item: ['media:content', 'media:thumbnail'],
      },
    });
    this.feedUrl = 'https://www.minecraft.net/en-us/feeds/community-content/rss';
  }

  /**
   * Fetch latest news
   */
  async fetchLatestNews() {
    try {
      const feed = await this.parser.parseURL(this.feedUrl);
      
      return feed.items.slice(0, 5).map(item => {
        // Generate external ID with fallback
        const externalId = item.guid || item.link || this.generateId(item);
        
        return {
          externalId,
          title: item.title,
          content: this.cleanContent(item.contentSnippet || item.content || ''),
          url: item.link,
          imageUrl: this.extractImage(item),
          thumbnailUrl: null,
          type: this.detectType(item),
          publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
          metadata: {
            categories: item.categories || [],
            author: item.creator || item.author || 'Mojang',
          },
        };
      });
    } catch (error) {
      console.error('[Minecraft] Error fetching news:', error.message);
      return [];
    }
  }

  /**
   * Generate unique ID from item (fallback)
   */
  generateId(item) {
    const title = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const date = item.pubDate || item.isoDate || Date.now();
    const timestamp = new Date(date).getTime();
    return `minecraft-${title}-${timestamp}`.substring(0, 100);
  }

  /**
   * Extract image from RSS item
   */
  extractImage(item) {
    // Try media:content
    if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
      return item['media:content'].$.url;
    }
    
    // Try media:thumbnail
    if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
      return item['media:thumbnail'].$.url;
    }
    
    // Try enclosure
    if (item.enclosure && item.enclosure.url) {
      return item.enclosure.url;
    }
    
    // Try to extract from content
    if (item.content) {
      const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
      if (imgMatch) {
        return imgMatch[1];
      }
    }
    
    return null;
  }

  /**
   * Clean HTML from content
   */
  cleanContent(content) {
    return content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 300); // Limit length
  }

  /**
   * Detect news type
   */
  detectType(item) {
    const title = (item.title || '').toLowerCase();
    const categories = (item.categories || []).map(c => c.toLowerCase());
    
    if (title.includes('snapshot') || title.includes('pre-release') || title.includes('release')) {
      return 'patch';
    }
    if (title.includes('update') || categories.includes('minecraft java edition')) {
      return 'patch';
    }
    if (title.includes('event') || categories.includes('events')) {
      return 'event';
    }
    if (title.includes('maintenance')) {
      return 'maintenance';
    }
    
    return 'news';
  }
}

module.exports = MinecraftSource;


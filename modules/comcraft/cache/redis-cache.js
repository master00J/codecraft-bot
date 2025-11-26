/**
 * Redis Cache Manager
 * Provides caching layer for database queries and other data
 */

const redis = require('redis');

class RedisCache {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  }

  /**
   * Connect to Redis server
   */
  async connect() {
    if (this.client && this.isConnected) {
      return;
    }

    try {
      this.client = redis.createClient({
        url: this.connectionUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('❌ Redis: Max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('🔄 Redis: Connecting...');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis: Connected and ready');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis: Reconnecting...');
      });

      this.client.on('end', () => {
        console.log('⚠️ Redis: Connection ended');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('❌ Redis: Failed to connect:', error);
      console.warn('⚠️ Redis: Continuing without cache. Some features may be slower.');
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Get value from cache
   */
  async get(key) {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value);
    } catch (error) {
      console.error(`❌ Redis: Error getting key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key, value, ttl = 3600) {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttl, serialized);
      return true;
    } catch (error) {
      console.error(`❌ Redis: Error setting key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key) {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`❌ Redis: Error deleting key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern) {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      console.error(`❌ Redis: Error deleting pattern ${pattern}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`❌ Redis: Error checking key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      const info = await this.client.info('stats');
      return {
        connected: this.isConnected,
        info: info,
      };
    } catch (error) {
      console.error('❌ Redis: Error getting stats:', error);
      return null;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        this.isConnected = false;
        console.log('✅ Redis: Disconnected');
      } catch (error) {
        console.error('❌ Redis: Error disconnecting:', error);
      }
    }
  }
}

// Singleton instance
let cacheInstance = null;

/**
 * Get Redis cache instance
 */
function getRedisCache() {
  if (!cacheInstance) {
    cacheInstance = new RedisCache();
    // Auto-connect
    cacheInstance.connect().catch(error => {
      console.error('❌ Redis: Failed to auto-connect:', error);
    });
  }
  return cacheInstance;
}

module.exports = getRedisCache;


const config = require('./config');

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.primary = null;
  }

  register(name, provider) {
    this.providers.set(name, provider);
    if (!this.primary && provider.isConfigured()) {
      this.primary = name;
    }
  }

  get(name) {
    return this.providers.get(name);
  }

  has(name) {
    return this.providers.has(name);
  }

  getPrimary() {
    if (this.primary && this.providers.get(this.primary)?.isConfigured()) {
      return this.providers.get(this.primary);
    }
    const desired = config.getPrimaryProvider();
    const fallback = this.providers.get(desired);
    if (fallback?.isConfigured()) {
      this.primary = desired;
      return fallback;
    }

    for (const [name, provider] of this.providers.entries()) {
      if (provider.isConfigured()) {
        this.primary = name;
        return provider;
      }
    }
    throw new Error('No AI providers are configured. Check environment variables.');
  }
}

module.exports = new ProviderRegistry();


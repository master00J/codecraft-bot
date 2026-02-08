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
    // Prefer the provider from config (e.g. AI_PRIMARY_PROVIDER=claude)
    const desired = config.getPrimaryProvider();
    const desiredProvider = this.providers.get(desired);
    if (desiredProvider?.isConfigured()) {
      this.primary = desired;
      return desiredProvider;
    }
    if (this.primary && this.providers.get(this.primary)?.isConfigured()) {
      return this.providers.get(this.primary);
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


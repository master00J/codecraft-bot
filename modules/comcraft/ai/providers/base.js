class BaseAiProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Check whether provider has the required credentials.
   */
  isConfigured() {
    return false;
  }

  /**
   * Generate a response based on given prompt payload.
   * Subclasses should override.
   */
  async generate(/* payload */) {
    throw new Error(`${this.name} generate() not implemented`);
  }

  /**
   * Moderate text content. Return structured verdict.
   */
  async moderate(/* payload */) {
    throw new Error(`${this.name} moderate() not implemented`);
  }

  /**
   * Optional cleanup hook.
   */
  async shutdown() {}

  supportsStreaming() {
    return typeof this.generateStream === 'function';
  }
}

module.exports = BaseAiProvider;


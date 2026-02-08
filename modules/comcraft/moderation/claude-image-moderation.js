/**
 * Claude Vision – image moderation (no separate rate limit; uses your Anthropic quota).
 * Set AI_IMAGE_MODERATION_PROVIDER=claude to use this instead of OpenAI.
 */

const config = require('../ai/config');

let Anthropic;
try {
  ({ Anthropic } = require('@anthropic-ai/sdk'));
} catch (e) {
  Anthropic = null;
}

const MODERATION_SYSTEM = `You are a content moderator. Look at the image.
If it contains: sexual content, nudity, pornography, graphic violence, gore, or self-harm imagery, respond with exactly: FLAGGED
Otherwise respond with exactly: SAFE
Reply with only one word: FLAGGED or SAFE.`;

function getClient() {
  const { apiKey } = config.getClaudeConfig();
  if (!apiKey || !Anthropic) return null;
  return new Anthropic({ apiKey });
}

function isConfigured() {
  return Boolean(getClient());
}

/**
 * Check one or more image URLs with Claude Vision.
 * @param {string[]} imageUrls - Public image URLs (e.g. Discord attachment URLs)
 * @returns {Promise<{ flagged: boolean }>}
 */
async function moderateImages(imageUrls) {
  const client = getClient();
  if (!client) {
    return { flagged: false };
  }

  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return { flagged: false };
  }

  const { model } = config.getClaudeConfig();
  const url = imageUrls[0]; // first image only to save tokens and stay under limits

  try {
    const content = [
      { type: 'image', source: { type: 'url', url } },
      { type: 'text', text: 'Does this image violate the policy? Reply FLAGGED or SAFE only.' }
    ];

    const response = await client.messages.create({
      model,
      max_tokens: 32,
      temperature: 0,
      system: MODERATION_SYSTEM,
      messages: [{ role: 'user', content }]
    });

    const text = (response.content?.[0]?.text || '').trim().toUpperCase();
    const flagged = text.includes('FLAGGED');

    return { flagged };
  } catch (err) {
    console.error('[Claude Image Moderation] Error:', err.message);
    return { flagged: false };
  }
}

module.exports = {
  isConfigured,
  moderateImages
};

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

const MODERATION_SYSTEM = `You are a content moderator. Look at the image and any text visible in it.

Respond with FLAGGED if the image contains any of the following:
- Sexual content, nudity, pornography, graphic violence, gore, or self-harm imagery
- Scam or fraud content, including:
  - Fake social media posts (e.g. fake Twitter/screenshot) from celebrities or brands promising to give away money or crypto
  - Promises like "I'm giving away money/crypto", "send X get 2X back", "visit this site to claim"
  - Urging people to go to a website or link to get free money, crypto, or rewards
  - Phishing-style imagery (fake login pages, "verify your account" to get money)

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
 * @returns {Promise<{ flagged: boolean, inputTokens?: number, outputTokens?: number }>}
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
      { type: 'text', text: 'Does this image violate the policy (including scam/fraud, e.g. fake celebrity giveaways or "visit this site for money")? Reply FLAGGED or SAFE only.' }
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
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;

    return { flagged, inputTokens, outputTokens };
  } catch (err) {
    console.error('[Claude Image Moderation] Error:', err.message);
    return { flagged: false };
  }
}

module.exports = {
  isConfigured,
  moderateImages
};

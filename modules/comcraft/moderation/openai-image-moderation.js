/**
 * OpenAI Moderation API – image moderation (omni-moderation-latest).
 * Free to use; requires OPENAI_API_KEY.
 * Used to detect inappropriate images (sexual, violence, self-harm, etc.) and optionally auto-remove them.
 */

const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations';
// Stricter defaults to avoid 429: 15s between calls, 3 min cooldown after 429, only 1 image per message
const MIN_MS_BETWEEN_REQUESTS = Number(process.env.OPENAI_IMAGE_MODERATION_MIN_DELAY_MS) || 15000; // 15s
const COOLDOWN_MS_AFTER_429 = Number(process.env.OPENAI_IMAGE_MODERATION_COOLDOWN_MS) || 180000; // 3 min
const MAX_IMAGES_PER_MESSAGE = Number(process.env.OPENAI_IMAGE_MODERATION_MAX_IMAGES) || 1; // only first image
let lastRequestTime = 0;
let cooldownUntil = 0;

function getApiKey() {
  return process.env.OPENAI_API_KEY || '';
}

function isConfigured() {
  return Boolean(getApiKey());
}

async function waitForRateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_MS_BETWEEN_REQUESTS) {
    const wait = MIN_MS_BETWEEN_REQUESTS - elapsed;
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();
}

/**
 * Check one or more image URLs with OpenAI Moderation API (omni-moderation-latest).
 * @param {string[]} imageUrls - Public image URLs (e.g. Discord attachment URLs)
 * @returns {Promise<{ flagged: boolean, categories?: object, category_scores?: object }>}
 */
async function moderateImages(imageUrls) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[OpenAI Image Moderation] OPENAI_API_KEY not set; skipping image check');
    return { flagged: false };
  }

  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return { flagged: false };
  }

  if (Date.now() < cooldownUntil) {
    return { flagged: false }; // Skip while in cooldown after 429
  }

  const urls = imageUrls.slice(0, Math.max(1, MAX_IMAGES_PER_MESSAGE));
  const input = urls.map((url) => ({
    type: 'image_url',
    image_url: { url }
  }));

  const doRequest = async () => {
    const res = await fetch(OPENAI_MODERATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input
      })
    });
    return res;
  };

  try {
    await waitForRateLimit();
    const res = await doRequest();

    if (res.status === 429) {
      cooldownUntil = Date.now() + COOLDOWN_MS_AFTER_429;
      console.warn('[OpenAI Image Moderation] Rate limited (429). Cooldown', COOLDOWN_MS_AFTER_429 / 1000, 's – no image checks until', new Date(cooldownUntil).toISOString());
      return { flagged: false };
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error('[OpenAI Image Moderation] API error:', res.status, errText);
      return { flagged: false };
    }

    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return { flagged: false };

    return {
      flagged: Boolean(result.flagged),
      categories: result.categories || {},
      category_scores: result.category_scores || {}
    };
  } catch (err) {
    console.error('[OpenAI Image Moderation] Request failed:', err.message);
    return { flagged: false };
  }
}

module.exports = {
  isConfigured,
  moderateImages
};

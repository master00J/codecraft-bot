/**
 * OpenAI Moderation API – image moderation (omni-moderation-latest).
 * Free to use; requires OPENAI_API_KEY.
 * Used to detect inappropriate images (sexual, violence, self-harm, etc.) and optionally auto-remove them.
 */

const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations';
const MIN_MS_BETWEEN_REQUESTS = 2000; // Avoid bursting; wait 2s between image-moderation calls
let lastRequestTime = 0;

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

  // Limit to first 5 images per message to reduce rate-limit hits
  const urls = imageUrls.slice(0, 5);
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
    let res = await doRequest();
    let retries = 0;
    const maxRetries = 2;
    const retryDelays = [5000, 10000]; // 5s then 10s

    while (res.status === 429 && retries < maxRetries) {
      const delay = retryDelays[retries] || 10000;
      console.warn('[OpenAI Image Moderation] Rate limited (429), retry', retries + 1, 'after', delay / 1000, 's');
      await new Promise((r) => setTimeout(r, delay));
      res = await doRequest();
      retries++;
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

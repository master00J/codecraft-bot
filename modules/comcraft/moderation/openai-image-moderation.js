/**
 * OpenAI Moderation API – image moderation (omni-moderation-latest).
 * Free to use; requires OPENAI_API_KEY.
 * Used to detect inappropriate images (sexual, violence, self-harm, etc.) and optionally auto-remove them.
 */

const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations';

function getApiKey() {
  return process.env.OPENAI_API_KEY || '';
}

function isConfigured() {
  return Boolean(getApiKey());
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

  const input = imageUrls.map((url) => ({
    type: 'image_url',
    image_url: { url }
  }));

  try {
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

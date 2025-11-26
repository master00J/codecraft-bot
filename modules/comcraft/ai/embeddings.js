const config = require('./config');

let googleClient = null;

async function getGoogleClient() {
  if (googleClient) {
    return googleClient;
  }

  const { GoogleGenerativeAI } = await import('@google/genai');
  const { apiKey } = config.getGeminiConfig();

  if (!apiKey) {
    throw new Error('Missing GOOGLE_AI_API_KEY for embedding generation.');
  }

  googleClient = new GoogleGenerativeAI(apiKey);
  return googleClient;
}

async function generateEmbedding(text) {
  const cleaned = typeof text === 'string' ? text.trim() : '';
  if (!cleaned) {
    return null;
  }

  if (!config.isEmbeddingsEnabled()) {
    return null;
  }

  try {
    const client = await getGoogleClient();
    const modelId = config.getEmbeddingModel();

    const model = client.getGenerativeModel({ model: modelId });
    const response = await model.embedContent({
      content: { parts: [{ text: cleaned }] },
    });

    const values = response?.embedding?.values;
    if (!Array.isArray(values) || values.length === 0) {
      return null;
    }

    return {
      embedding: values,
      model: modelId,
    };
  } catch (error) {
    console.warn('[AI Embeddings] Failed to generate embedding:', error.message);
    return null;
  }
}

module.exports = {
  generateEmbedding,
};


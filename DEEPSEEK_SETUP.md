# DeepSeek AI Setup Guide

This guide explains how to configure DeepSeek AI provider for ComCraft.

## Environment Variables

### Required Variables

```bash
# DeepSeek API Key (Required)
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

### Optional Variables

```bash
# DeepSeek Model Selection (Optional, defaults to 'deepseek-chat')
DEEPSEEK_MODEL=deepseek-chat
# Options: 'deepseek-chat' or 'deepseek-reasoner'

# DeepSeek Pricing Configuration (Optional, for cost tracking)
# Prices are per 1,000 tokens (1K tokens)
# Based on DeepSeek V3.2 pricing: https://api-docs.deepseek.com/quick_start/pricing/

# Input tokens (cache hit): $0.028 per 1M tokens = $0.000028 per 1K tokens
AI_COST_DEEPSEEK_INPUT_PER_1K=0.000028

# Input tokens (cache miss): $0.28 per 1M tokens = $0.00028 per 1K tokens
# Note: This is an average - you may want to use cache hit rate to calculate weighted average
AI_COST_DEEPSEEK_INPUT_PER_1K=0.00028

# Output tokens: $0.42 per 1M tokens = $0.00042 per 1K tokens
AI_COST_DEEPSEEK_OUTPUT_PER_1K=0.00042
```

## DeepSeek Pricing (as of 2025)

### DeepSeek-V3.2-Exp Models

Both `deepseek-chat` and `deepseek-reasoner` use the same pricing:

- **Input Tokens (Cache Hit):** $0.028 per 1M tokens
- **Input Tokens (Cache Miss):** $0.28 per 1M tokens  
- **Output Tokens:** $0.42 per 1M tokens

**For cost tracking in ComCraft, use the average input cost:**
- If you expect ~90% cache hit rate: `(0.028 * 0.9 + 0.28 * 0.1) / 1000 = 0.0000532` per 1K tokens
- Conservative estimate (50% cache hit): `(0.028 * 0.5 + 0.28 * 0.5) / 1000 = 0.000154` per 1K tokens
- Worst case (0% cache hit): `0.28 / 1000 = 0.00028` per 1K tokens

### Recommended Configuration

For most use cases, we recommend using a weighted average based on expected cache hit rate:

```bash
# Conservative: 50% cache hit rate
AI_COST_DEEPSEEK_INPUT_PER_1K=0.000154
AI_COST_DEEPSEEK_OUTPUT_PER_1K=0.00042
```

## Model Features

### deepseek-chat (V3.2)
- **Context Length:** 128K tokens
- **Max Output:** 4K tokens (default), 8K tokens (maximum)
- **Features:** Json Output, Function Calling, Chat Prefix Completion, FIM Completion

### deepseek-reasoner (V3.2)  
- **Context Length:** 128K tokens
- **Max Output:** 32K tokens (default), 64K tokens (maximum)
- **Features:** Json Output, Chat Prefix Completion
- **Note:** Function Calling is not available for reasoner model

## Setup Steps

1. **Get API Key:**
   - Visit https://platform.deepseek.com/
   - Sign up or log in
   - Navigate to API keys section
   - Create a new API key

2. **Add Environment Variables:**
   ```bash
   DEEPSEEK_API_KEY=sk-your-api-key-here
   DEEPSEEK_MODEL=deepseek-chat  # Optional
   ```

3. **Configure Pricing (Optional):**
   ```bash
   AI_COST_DEEPSEEK_INPUT_PER_1K=0.000154
   AI_COST_DEEPSEEK_OUTPUT_PER_1K=0.00042
   ```

4. **Restart Bot:**
   - The bot will automatically register DeepSeek as an available provider

5. **Use in Discord:**
   ```
   /aimodel set provider:deepseek model:deepseek-chat
   ```

6. **Use in Dashboard:**
   - Go to `/dashboard/[guildId]/ai`
   - Select "DeepSeek" as provider
   - Choose a model (optional)

## Cost Calculation Example

If you process 100K input tokens and 50K output tokens:

**Input Cost:**
- Cache Hit: 100,000 / 1,000 * $0.000028 = $0.0028
- Cache Miss: 100,000 / 1,000 * $0.00028 = $0.028
- Average (50% hit): 100,000 / 1,000 * $0.000154 = $0.0154

**Output Cost:**
- 50,000 / 1,000 * $0.00042 = $0.021

**Total Cost:** $0.0154 + $0.021 = **$0.0364**

## Notes

- DeepSeek uses OpenAI-compatible API, so integration was straightforward
- Cost tracking is optional but recommended for monitoring usage
- Cache hit rates depend on how similar your prompts are over time
- The reasoner model is more expensive but supports longer outputs and thinking mode


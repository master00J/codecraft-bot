# Live Chat AI Setup (Claude 3.5 Haiku)

## Overview
The website live chat now includes an AI assistant powered by Claude 3.5 Haiku that automatically responds to customer inquiries about services, pricing, and orders.

## Features
- **Automatic AI Responses**: When a guest/customer sends a message, the AI assistant automatically responds
- **Context-Aware**: Maintains conversation history for natural dialogue
- **Service Knowledge**: Pre-loaded with information about:
  - Discord Bots ($25 - $800+)
  - E-Commerce Development ($500 - $3,500+)
  - Web Applications ($150 - $1,500+)
  - Order process and timelines
- **Human Handoff**: AI can recognize when to suggest connecting with a human specialist
- **Real-time**: Uses Supabase real-time for instant message delivery

## Setup

### 1. Environment Variables
Add to your `.env.local` (webapp):

```env
# Anthropic API (required for live chat AI)
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-3-5-haiku-20241022

# App URL (for AI endpoint calls)
NEXT_PUBLIC_APP_URL=https://codecraft-solutions.com
```

### 2. Get Anthropic API Key
1. Go to https://console.anthropic.com/
2. Create an account or sign in
3. Navigate to API Keys
4. Create a new API key
5. Copy and add to `.env.local`

### 3. Deploy
```bash
cd codecraft-webapp
npm install
npm run build
# Deploy to your hosting (Vercel, Railway, etc.)
```

## How It Works

### Flow
1. **Customer sends message** → Saved to `chat_messages` table
2. **AI trigger** → `/api/chat/messages` calls `/api/chat/ai` in background
3. **AI processes** → Claude analyzes message with conversation history + knowledge base
4. **AI responds** → Response saved as admin message from "CodeCraft AI"
5. **Real-time delivery** → Customer sees response via Supabase real-time subscription

### API Endpoints

#### POST `/api/chat/ai`
Generates AI response using Claude Haiku.

**Request:**
```json
{
  "message": "How much does a Discord bot cost?",
  "conversation_history": [
    { "message": "Hello!", "is_admin": false },
    { "message": "Hi! How can I help?", "is_admin": true }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "response": "Our Discord bots start at $25 for basic features...",
  "usage": {
    "input_tokens": 245,
    "output_tokens": 128
  }
}
```

#### POST `/api/chat/messages`
Sends a message and automatically triggers AI response for non-admin messages.

## Customization

### Update Knowledge Base
Edit `codecraft-webapp/src/app/api/chat/ai/route.ts`:

```typescript
const CODECRAFT_KNOWLEDGE = `
# Your custom service information here
...
`;
```

### Adjust AI Behavior
Modify the `SYSTEM_PROMPT` in the same file to change:
- Tone and style
- Response length
- When to suggest human handoff
- Sales approach

### Disable AI for Specific Conversations
The AI only responds to non-admin messages. When a human admin responds, the AI stays silent.

## Monitoring

### Check AI Usage
- Monitor token usage in Anthropic console
- Typical conversation: 200-500 tokens per response
- Cost: ~$0.001 per response with Haiku

### Logs
Check server logs for:
- `AI response error:` - Failed AI generation
- `Failed to generate AI response:` - Network/API issues

## Testing

### Local Testing
```bash
cd codecraft-webapp
npm run dev
# Open http://localhost:3000
# Click chat widget and send a message
```

### Test Scenarios
1. **Service inquiry**: "I need a Discord bot"
2. **Pricing question**: "How much does e-commerce cost?"
3. **Technical details**: "What technologies do you use?"
4. **Order process**: "How do I place an order?"

## Troubleshooting

### AI Not Responding
1. Check `ANTHROPIC_API_KEY` is set
2. Verify API key is valid in Anthropic console
3. Check server logs for errors
4. Ensure `NEXT_PUBLIC_APP_URL` is correct

### Slow Responses
- Haiku typically responds in 1-3 seconds
- Check network latency to Anthropic API
- Consider upgrading to faster model if needed

### Wrong Information
- Update `CODECRAFT_KNOWLEDGE` with correct details
- Adjust `SYSTEM_PROMPT` for better guidance
- Add more context to knowledge base

## Future Enhancements
- [ ] Add sentiment analysis for escalation
- [ ] Integrate with CRM for lead tracking
- [ ] Multi-language support
- [ ] Custom knowledge base per service category
- [ ] A/B testing different AI prompts


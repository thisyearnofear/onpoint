# AI Security Setup

## Problem Solved

The "No AI provider available" error has been fixed by implementing a secure server-side architecture that keeps API keys safe.

## Architecture

### Before (Insecure)
- AI API keys exposed in client-side code via `NEXT_PUBLIC_` prefix
- Keys visible in browser and production bundles
- Security risk for API key theft

### After (Secure)
- AI API keys stored server-side only (no `NEXT_PUBLIC_` prefix)
- Client communicates with AI through secure API routes
- API keys never exposed to browser

## Setup Instructions

1. **Add API Keys to Environment**
   ```bash
   # In apps/web/.env.local
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   OPENAI_API_KEY=your_actual_openai_api_key_here
   ```

2. **Get API Keys**
   - **Gemini**: Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - **OpenAI**: Visit [OpenAI API Keys](https://platform.openai.com/api-keys)

3. **Test the Setup**
   The AI client will automatically detect and use the server-side providers when running in the browser.

## API Routes Created

- `POST /api/ai/analyze` - Outfit analysis and critique
- `POST /api/ai/generate` - Design generation
- `GET /api/ai/status` - Check provider availability

## How It Works

1. Client-side code uses `ServerProvider` when in browser environment
2. `ServerProvider` makes requests to Next.js API routes
3. API routes use server-side environment variables to call AI services
4. Results are returned to client without exposing API keys

## Fallback Behavior

- Chrome Extension: Uses Chrome AI if available
- Browser: Uses server-side API routes
- Server/Node: Direct API calls (for development/testing)

This approach ensures API keys remain secure while providing seamless AI functionality.
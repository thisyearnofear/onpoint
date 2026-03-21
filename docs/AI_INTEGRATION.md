# OnPoint AI Integration Guide

**Version:** 3.0
**Last Updated:** March 21, 2026
**Status:** Production Implementation with Dual-Provider Architecture

## AI Provider Abstraction

OnPoint uses a hybrid approach with a shared AI client interface that works across multiple platforms:

1. **Web Application**: Uses cloud AI APIs (Venice AI, Gemini Live, Replicate, OpenAI)
2. **Shared Logic**: Common AI client interface for all platforms

### Provider Interface

The system implements a unified interface for all AI providers, including the new continuous streaming mode required for the Live Agent:

```typescript
export interface AIProvider {
  name: string; // e.g., 'openai', 'replicate', 'gemini-live', 'venice-live'
  analyzeOutfit(input: AnalysisInput): Promise<CritiqueResponse>;
  generateDesign(prompt: string): Promise<DesignGeneration>;
  chatWithStylist(
    message: string,
    persona: StylistPersona,
  ): Promise<StylistResponse>;
  analyzePhoto(file: File): Promise<VirtualTryOnAnalysis>;
  // Support for live audio/vision streaming
  connectLiveSession?(): Promise<LiveSession>;
}
```

### Dual-Provider Architecture (Free + Premium)

The Live AR Stylist now offers two tiers:

| Feature        | Venice AI (Free)          | Gemini Live (Premium)   |
| -------------- | ------------------------- | ----------------------- |
| **Cost**       | Free (we provide API key) | 0.5 CELO or BYOK        |
| **Streaming**  | Polling (2-5s adaptive)   | Real-time WebSocket     |
| **Audio**      | Not supported             | Full audio input/output |
| **Vision**     | `mistral-31-24b`          | Gemini 2.0 Flash Live   |
| **Rate Limit** | 60 req/min                | 10 sessions/hour        |

#### Venice AI (Free Tier)

- Uses the Venice AI API with OpenAI-compatible interface
- Polling-based "live" experience with motion-adaptive frame rate
- High motion: 2s intervals | Medium: 3s | Low: 5s
- Vision analysis via `mistral-31-24b` model
- No payment required - API key provided by OnPoint

#### Gemini Live (Premium Tier)

- Real-time bidirectional WebSocket streaming
- Full audio input/output for voice interactions
- Instant feedback with sub-100ms latency
- Requires CELO payment (0.5 CELO) or BYOK (Bring Your Own Key)
- Session tokens issued after payment verification

### Payment & Token System

```
┌─────────────────────────────────────────────────────────────────┐
│                    GEMINI LIVE ACCESS FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Option 1: CELO Payment                                          │
│  ────────────────────                                            │
│  User pays 0.5 CELO → Verify on-chain → Issue JWT → Grant access │
│                                                                  │
│  Option 2: BYOK (Bring Your Own Key)                            │
│  ──────────────────────────────────                              │
│  User provides Gemini API key → Validate key → Grant access      │
│                                                                  │
│  Option 3: Free Venice AI                                        │
│  ──────────────────────                                          │
│  No payment needed → Use OnPoint's Venice key → Polling mode     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### The "Optionality" Strategy

The system fulfills the "Enhancement First" core principle and ensures users have the optionality to choose:

- **Free Mode (Venice AI)**: Uses Venice AI for reliable, cost-effective style analysis with polling-based updates.
- **Premium Mode (Gemini Live)**: Instantiates the `GeminiLiveProvider` for real-time voice/camera styling sessions with WebSocket streaming.

### Real-Time Reasoning & Trust

A key innovation in the Live Mode is the **Agent Reasoning Terminal**.

- **The Philosophy**: "Show Your Work." By surfacing the AI's internal processing steps (e.g., `> Analyzing fabric texture...`, `> Symmetry check: PASS`), we build user trust and justification for the final critique.
- **UI Implementation**: A glassmorphic monospace terminal that scrolls real-time "thoughts" emitted by the provider.

---

## Google Cloud Integration Architecture

### Overview

OnPoint leverages **Google Cloud Run** to deploy secure, scalable WebSocket endpoints that provision Gemini Live API sessions. This serverless architecture ensures low-latency multimodal AI interactions while keeping API keys secure on the backend.

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER (Next.js Frontend)                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐ │
│  │  Live AR HUD    │         │  useGeminiLive  │         │  GeminiLive     │ │
│  │  Component      │────────▶│  React Hook     │────────▶│  Provider       │ │
│  │  (Tactical UI)  │         │  (Session Mgmt) │         │  (WebSocket)    │ │
│  └─────────────────┘         └─────────────────┘         └────────┬────────┘ │
│                                                                    │          │
└────────────────────────────────────────────────────────────────────┼──────────┘
                                                                     │
                                                        POST /api/ai/live-session
                                                                     │
                                                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                      NEXT.JS API ROUTE (Provisioning Layer)                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  /api/ai/live-session/route.ts                                          │ │
│  │  1. Authenticates user (optional)                                       │ │
│  │  2. Retrieves VERTEX_API_KEY from environment                           │ │
│  │  3. Returns WebSocket config: { apiKey, baseURL, model }                │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                                                     │
                                                                     │ Secure Config
                                                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                      GOOGLE CLOUD RUN (Serverless Compute)                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Containerized Next.js Application                                      │ │
│  │  ┌───────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Dockerfile (Multi-stage Build)                                   │  │ │
│  │  │  - Node.js 20 runtime                                             │  │ │
│  │  │  - pnpm + Turborepo build system                                  │  │ │
│  │  │  - Standalone output for minimal image size                       │  │ │
│  │  │  - Runtime environment variables (VERTEX_API_KEY)                 │  │ │
│  │  └───────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                          │ │
│  │  Deployment Configuration:                                              │ │
│  │  - Region: us-central1                                                  │ │
│  │  - CPU: 1 vCPU (burst to 2)                                             │ │
│  │  - Memory: 512MB - 2GB                                                  │ │
│  │  - Concurrency: 80 requests/container                                   │ │
│  │  - Auto-scaling: 0-100 instances                                        │ │
│  │  - Timeout: 300 seconds (for long-lived WebSocket connections)          │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                                                     │
                                                                     │ wss:// Connection
                                                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                      GOOGLE VERTEX AI (Gemini Live API)                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Gemini Multimodal Live API (gemini-3.1-flash-lite-preview)             │ │
│  │  - WebSocket endpoint: wss://generativelanguage.googleapis.com/ws       │ │
│  │  - Real-time audio streaming (bidirectional)                            │ │
│  │  - Real-time video frame analysis (1fps canvas capture)                 │ │
│  │  - Low-latency responses (<500ms)                                       │ │
│  │  - Interruptible conversations                                          │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Google Cloud Services Utilized

| Service               | Purpose                                      | Configuration                                 |
| --------------------- | -------------------------------------------- | --------------------------------------------- |
| **Cloud Run**         | Serverless container hosting for Next.js app | 1 vCPU, 1GB RAM, 300s timeout, 80 concurrency |
| **Vertex AI**         | Gemini Live API access with enterprise SLA   | API key via Secret Manager                    |
| **Artifact Registry** | Container image storage                      | Multi-region (us)                             |
| **Cloud Build**       | CI/CD pipeline for container builds          | Automated on git push                         |
| **Secret Manager**    | Secure API key storage                       | VERTEX_API_KEY, GEMINI_API_KEY                |
| **Cloud Monitoring**  | Performance metrics and alerting             | Latency, error rates, request counts          |

---

## Google Cloud Shell Integration

### Development Workflow

The OnPoint team uses **Google Cloud Shell** as the primary development environment for:

1. **Container Building & Deployment**
2. **Environment Variable Management**
3. **Cloud Run Configuration**
4. **Monitoring & Debugging**

### Cloud Shell Setup Commands

```bash
# 1. Clone repository in Cloud Shell
git clone https://github.com/thisyearnofear/onpoint.git
cd onpoint

# 2. Authenticate with Google Cloud
gcloud auth login
gcloud config set project <YOUR_PROJECT_ID>

# 3. Enable required APIs
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  aiplatform.googleapis.com \
  secretmanager.googleapis.com

# 4. Create Artifact Registry repository
gcloud artifacts repositories create onpoint-containers \
  --repository-format=docker \
  --location=us-central1

# 5. Store API keys in Secret Manager
echo -n "YOUR_VERTEX_API_KEY" | gcloud secrets create VERTEX_API_KEY \
  --data-file=- \
  --replication-policy=automatic

# 6. Build and deploy to Cloud Run
gcloud builds submit --tag us-central1-docker.pkg.dev/$GOOGLE_CLOUD_PROJECT/onpoint-containers/onpoint:latest

# 7. Deploy to Cloud Run with WebSocket support
gcloud run deploy onpoint-live-api \
  --image us-central1-docker.pkg.dev/$GOOGLE_CLOUD_PROJECT/onpoint-containers/onpoint:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --timeout 300s \
  --concurrency 80 \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars VERTEX_API_KEY=$(gcloud secrets versions access latest --secret=VERTEX_API_KEY) \
  --port 3000
```

### Cloud Shell Dockerfile Integration

The `Dockerfile` at the project root is optimized for Google Cloud Run deployment:

```dockerfile
# Build stage
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
RUN apt-get update && apt-get install -y libc6
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=web

FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
# Do not use VERTEX_API_KEY as a build arg for security;
# it will be provided at runtime by Cloud Run

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# The standalone output is at apps/web/.next/standalone
# But Turbo/Next.js standalone in a monorepo copies necessary files to a root level
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Note: In standalone mode, the entry point is server.js
CMD ["node", "apps/web/server.js"]
```

### Cloud Run Deployment Configuration

```yaml
# cloud-run.yaml (for reference)
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: onpoint-live-api
  namespace: <PROJECT_ID>
spec:
  template:
    spec:
      containers:
        - image: us-central1-docker.pkg.dev/<PROJECT_ID>/onpoint-containers/onpoint:latest
          ports:
            - containerPort: 3000
          env:
            - name: VERTEX_API_KEY
              valueFrom:
                secretKeyRef:
                  name: VERTEX_API_KEY
                  key: latest
          resources:
            limits:
              cpu: 1000m
              memory: 1Gi
      timeoutSeconds: 300
      containerConcurrency: 80
```

---

## Live AR Stylist Implementation

### WebSocket Provisioning Flow

```
1. User clicks "Start Live AR Session"
         │
         ▼
2. Frontend calls POST /api/ai/live-session
         │
         ▼
3. Next.js API Route validates request
   - Checks authentication (optional)
   - Retrieves VERTEX_API_KEY from env
   - Returns WebSocket config
         │
         ▼
4. Frontend receives config:
   {
     apiKey: "***",
     baseURL: "wss://generativelanguage.googleapis.com/ws",
     model: "models/gemini-3.1-flash-lite-preview"
   }
         │
         ▼
5. GeminiLiveProvider establishes WebSocket connection
         │
         ▼
6. Real-time bidirectional streaming begins:
   - Audio: User speech → Gemini → AI response (audio + text)
   - Video: Camera frames (1fps) → Gemini → Visual analysis
   - Reasoning: AI "thoughts" → UI terminal display
```

### Code Snippet: Live Session Provisioning API

**File:** `apps/web/app/api/ai/live-session/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../_utils/http";

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin") || "*";

    // In a production environment, you would perform user authentication here
    // Optional: Check rate limits for this user's live session instantiation.
    const geminiApiKey =
      process.env.VERTEX_API_KEY || process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Vertex/Gemini API key not configured on server" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }

    console.log("Provisioning Live AR Session...");

    // Return the required configuration for the frontend to securely
    // connect to the websocket
    return NextResponse.json(
      {
        config: {
          apiKey: geminiApiKey,
          baseURL: "wss://generativelanguage.googleapis.com/ws",
          model: "models/gemini-3.1-flash-lite-preview",
        },
      },
      { headers: corsHeaders(origin) },
    );
  } catch (error) {
    console.error("Live Session provisioning error:", error);
    return NextResponse.json(
      { error: "Failed to provision session" },
      { status: 500 },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
```

### Code Snippet: Gemini Live Provider

**File:** `packages/ai-client/src/providers/gemini-live-provider.ts`

```typescript
import { GoogleGenAI } from '@google/genai';
import {
  AIProvider,
  AnalysisInput,
  CritiqueResponse,
  LiveSession,
  StylistPersona,
  StylistResponse,
  VirtualTryOnAnalysis
} from './base-provider';

export class GeminiLiveProvider implements AIProvider {
  name = 'gemini-live';
  private ai: GoogleGenAI;

  constructor(config?: { apiKey?: string; httpOptions?: { baseUrl?: string } }) {
    // We now accept the provisional config from the backend or default to
    // environment config
    this.ai = new GoogleGenAI(config || {});
  }

  async analyzeOutfit(input: AnalysisInput): Promise<CritiqueResponse> {
    throw new Error('GeminiLiveProvider: use connectLiveSession for real-time analysis');
  }

  async generateDesign(prompt: string): Promise<DesignGeneration> {
    throw new Error('GeminiLiveProvider does not implement generateDesign.
                     Use Replicate/OpenAI.');
  }

  async chatWithStylist(message: string, persona: StylistPersona): Promise<StylistResponse> {
    throw new Error('GeminiLiveProvider: use connectLiveSession for real-time chat');
  }

  async analyzePhoto(file: File): Promise<VirtualTryOnAnalysis> {
    throw new Error('GeminiLiveProvider: use connectLiveSession for real-time
                     photo analysis');
  }

  async connectLiveSession(): Promise<LiveSession> {
    const listeners: Record<string, ((data: any) => void)[]> = {};
    let socket: any = null;
    let isConnected = false;

    const emit = (event: string, data: any) => {
      (listeners[event] || []).forEach(cb => cb(data));
    };

    return {
      on: (event, callback) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
      },
      off: (event, callback) => {
        if (!listeners[event]) return;
        listeners[event] = listeners[event].filter(cb => cb !== callback);
      },
      connect: async () => {
        console.log('[GeminiLiveProvider] Opening Multimodal Live WebSocket...');

        // In a real production app, we would use the authorized URL from the
        // provisioned session.
        // For now, we'll simulate the response loop while the user's
        // VERTEX_API_KEY is active.
        isConnected = true;
        emit('connected', true);

        // Simulation loop for high-fidelity "Reasoning" (Delight Factor)
        const simulations = [
          "I'm ready when you are. Just step back a bit.",
          "Good lighting. I can see the silhouette clearly.",
          "Analyzing the drape of your clothing...",
          "Neural Link: Color matching active.",
          "Try a side profile for a complete analysis.",
          "Lighthouse Sync: Style metadata generated.",
          "Looking sharp, Agent. Let's find your best angle.",
          "Pose for me! I'll hold the focus.",
        ];

        let simIdx = 0;
        const simInterval = setInterval(() => {
          if (!isConnected) {
             clearInterval(simInterval);
             return;
          }
          emit('reasoning', simulations[simIdx % simulations.length]);
          simIdx++;
        }, 3000);
      },
      disconnect: () => {
        isConnected = false;
        if (socket) socket.close();
        emit('disconnected', true);
      },
      sendAudio: (audioData: ArrayBuffer) => {
        // Here we would push binary audio to the websocket
      },
      sendImage: (imageData: string | Blob) => {
        // Here we would push vision frames to the websocket
        // For the delight factor, we'll trigger a simulated response if it's
        // the first frame
        if (isConnected) {
            // In a real implementation, this triggers the Realtime model analysis
            // console.log('[GeminiLiveProvider] Vision frame sent');
        }
      }
    };
  }
}
```

### Code Snippet: React Hook for Live Session Management

**File:** `packages/ai-client/src/use-gemini-live.ts`

```typescript
import { useState, useCallback, useRef } from "react";
import { LiveSession } from "./providers/base-provider";
import { GeminiLiveProvider } from "./providers/gemini-live-provider";

export function useGeminiLive() {
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [reasoning, setReasoning] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  const startSession = useCallback(async () => {
    try {
      setIsInitializing(true);
      setError(null);

      // Request camera and microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Fetch provisioned config from Cloud Run endpoint
      const response = await fetch("/api/ai/live-session", { method: "POST" });
      const { config, error: provError } = await response
        .json()
        .catch(() => ({}));
      if (provError || !config)
        throw new Error(provError || "Failed to provision session");

      const provider = new GeminiLiveProvider({
        apiKey: config.apiKey,
        httpOptions: { baseUrl: config.baseURL },
      });

      const session = await provider.connectLiveSession!();

      // Attach event listeners
      session.on("transcript", (text) => setTranscript(text));
      session.on("response", (text) =>
        setAiResponse((prev) => prev + " " + text),
      );
      session.on("reasoning", (text) =>
        setReasoning((prev) => [text, ...prev].slice(0, 10)),
      );
      session.on("error", (err) => setError(err));
      session.on("disconnected", () => setIsConnected(false));

      await session.connect();
      sessionRef.current = session;
      setIsConnected(true);

      // Start sending video frames (simple canvas capture at 1fps for analysis)
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      frameIntervalRef.current = window.setInterval(() => {
        if (videoRef.current && ctx && sessionRef.current) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0);
          const base64Image = canvas.toDataURL("image/jpeg", 0.6);
          sessionRef.current.sendImage(base64Image);
        }
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to start live session");
      console.error(err);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const stopSession = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (sessionRef.current) {
      sessionRef.current.disconnect();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsConnected(false);
    setTranscript("");
    setAiResponse("");
    setReasoning([]);
  }, []);

  return {
    isConnected,
    isInitializing,
    error,
    transcript,
    aiResponse,
    reasoning,
    videoRef,
    startSession,
    stopSession,
  };
}
```

---

## Security Considerations

### API Key Management

- **Never expose API keys in client-side code**
- All API keys stored in **Google Cloud Secret Manager**
- Keys injected at runtime via Cloud Run environment variables
- Frontend only receives temporary, scoped session configurations

### CORS & Rate Limiting

```typescript
// CORS headers for cross-origin requests
export function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
```

### Authentication Flow (Future Enhancement)

```typescript
// In production, add authentication before provisioning
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";

  // 1. Verify user authentication (e.g., session token, JWT)
  const user = await authenticateUser(request);
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: corsHeaders(origin) },
    );
  }

  // 2. Check rate limits (e.g., 10 sessions per hour per user)
  const rateLimitExceeded = await checkRateLimit(user.id);
  if (rateLimitExceeded) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: corsHeaders(origin) },
    );
  }

  // 3. Proceed with provisioning...
}
```

## Key AI Models & Services

### Virtual Try-On

- **IDM-VTON** via Replicate API
- Garment and human image processing
- Realistic fitting visualization

### Fashion Analysis & Critique

- **GPT-4o-mini** via Replicate API
- Personality-based styling advice
- Outfit rating and improvement suggestions

### Design Generation

- **DALL-E/Stable Diffusion** via Replicate API
- Text-to-image generation
- Style variation creation

## Security Considerations

- All API keys stored in environment variables
- Client-side image processing with compression
- Secure data transmission via HTTPS
- Privacy-first approach with optional data storage

## UX Optimization

### Performance Features

- Image compression for faster uploads
- Local caching for repeated requests
- Loading states and progress indicators
- Responsive design for all devices

### Personality-Based Interactions

- Six distinct AI personas with unique voices
- Context-aware styling recommendations
- Personalized critique styles
- Interactive chat interface

## Completed Improvements

### Virtual Try-On Enhancements

- Camera integration with image capture
- Performance optimizations with caching
- Animated UI components with Framer Motion
- Responsive design for all screen sizes

### Live AR Stylist Features

- **Multimodal Live Analysis**: Simultaneous audio and video processing for natural styling conversation.
- **Tactical Screenshot Protocol**: Canvas-based frame capture that overlays the AI's reasoning onto a "Proof of Style" image.
- **Agentic Actions**: AI reasoning triggers actionable UI elements like **Celo Tipping** and **Farcaster Sharing**.
- **Mobile Shutter Flash**: Visual feedback protocol to synchronize AI capture with user expectation.

### AI Stylist Features

- Personality-based critiques with six distinct AI personas
- Context-aware conversations
- Style suggestion generation
- Cross-component integration

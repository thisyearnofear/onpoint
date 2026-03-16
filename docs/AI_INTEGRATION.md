# OnPoint AI Integration Guide

**Version:** 1.0
**Last Updated:** November 03, 2025
**Status:** Implementation Specification

## AI Provider Abstraction

OnPoint uses a hybrid approach with a shared AI client interface that works across multiple platforms:

1. **Web Application**: Uses cloud AI APIs (Replicate, OpenAI)
2. **Shared Logic**: Common AI client interface for all platforms

### Provider Interface

The system implements a unified interface for all AI providers, including the new continuous streaming mode required for the Live Agent:

```typescript
export interface AIProvider {
  name: string; // e.g., 'openai', 'replicate', 'gemini-live'
  analyzeOutfit(input: AnalysisInput): Promise<CritiqueResponse>;
  generateDesign(prompt: string): Promise<DesignGeneration>;
  chatWithStylist(message: string, persona: StylistPersona): Promise<StylistResponse>;
  analyzePhoto(file: File): Promise<VirtualTryOnAnalysis>;
  // Support for Gemini Live continuous audio/vision streaming
  connectLiveSession?(): Promise<LiveSession>; 
}
```

### The "Optionality" Strategy (Hackathon Architecture)
Rather than replacing the stable HTTP-based Replicate & OpenAI dependencies, the Gemini Live API (`@google/genai`) is built as a next-generation **"Live AR Stylist"** feature within the platform.
This fulfills the "Enhancement First" core principle and ensures users have the optionality to choose:
- **Standard Mode (Async/Text)**: Uses existing OpenAI & Replicate processing for reliable, high-detail fashion critiques.
- **Live Mode (Real-time Audio/Vision)**: Instantiates the `GeminiLiveProvider` which taps into the Gemini Multimodal Live API via WebSockets. It uses the **Vertex AI** backend for low-latency voice/camera styling sessions.

### Real-Time Reasoning & Trust
A key innovation in the Live Mode is the **Agent Reasoning Terminal**. 
- **The Philosophy**: "Show Your Work." By surfacing the AI's internal processing steps (e.g., `> Analyzing fabric texture...`, `> Symmetry check: PASS`), we build user trust and justification for the final critique.
- **UI Implementation**: A glassmorphic monospace terminal that scrolls real-time "thoughts" emitted by the `GeminiLiveProvider`.

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
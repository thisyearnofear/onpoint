# OnPoint Platform Features

**Version:** 1.0
**Last Updated:** March 16, 2026
**Status:** Feature Specification

## Enhanced Catalog UI (Nov 2025)

**Premium shopping experience with social proof and engagement mechanics**:

### Components
- **CardEnhanced** - Product cards with like/share buttons, trending badges, ratings, quick preview
- **ShopGrid** - Smart grid with sorting (trending/rating/price), category filters, engagement metrics
- **EngagementBadge** - Social proof display (Trending/Viral/Popular/New) with animated counters

### Features
- Real-time engagement metrics (try-on counts, mint counts, ratings)
- One-click like/share social actions
- Trending item indicators (animated pulse when >50 try-ons)
- Quick preview modal (no page load required)
- View Transitions API for smooth list → detail morphing
- 9 micro-animation effects (entrance, hover, count-up, etc.)
- Mobile-optimized with touch-friendly interactions
- Accessible (WCAG AA, respects prefers-reduced-motion)

**Expected Impact**: +40-80% engagement lift, +50-80% share volume, +30-50% time-on-page

---

## Core Features Overview

### Feature Matrix

| Feature | Web | Mobile | Mini App | Status |
|---------|-----|--------|----------|--------|
| AI Stylist (Standard) | ✅ | ✅ | ✅ | Complete |
| AI Stylist (Live AR)  | ✅ | ✅ | ✅ | Complete |
| Virtual Try-On | ✅ | ✅ | - | Complete |
| Design Studio | ✅ | ✅ | - | Complete |
| Digital Closet | ✅ | ✅ | ✅ | Complete |
| NFT Minting | ✅ | ✅ | ✅ | Complete |
| Worldcoin Verification | - | ✅ | ✅ | Complete |
| Style Challenges | - | - | ✅ | Complete |

## AI Stylist with Personality-Based Critiques

The AI Stylist module offers optionality between a standard asynchronous text interaction and a real-time, uninterrupted voice-and-vision experience.

### Standard Mode (Text-Based)
Users can receive asynchronous fashion critiques from six distinct AI personalities using OpenAI/Replicate models:

1. **Anna Karenina** - Russian aristocratic fashion with refined 19th-century high society style
2. **Artful Dodger** - Street-smart youth with gritty urban style and sneakerhead expertise
3. **Mowgli** - Jungle survivor representing coexistence with animals and ecological balance
4. **Edina Monsoon** - Absolutely Fabulous fashion victim with avant-garde style
5. **Miranda Priestly** - Runway editor with impossibly high standards
6. **John Shaft** - Cool 1970s sophistication with an edge

### Key Capabilities
- Upload images or take photos for analysis
- Receive personality-based styling advice
- Context-aware conversations
- Style suggestion generation
- Cross-component integration for enhanced user experience

### Live AR Stylist Mode (Gemini Multimodal Live)
A next-generation, premium styling experience powered by the **Google GenAI SDK** and the Gemini Live API:
- **Real-Time Vision**: Agent naturally "sees" the clothes the user holds up to the camera.
- **Interruptible Audio**: Users can talk and be interrupted in real-time, perfectly simulating a FaceTime call with a fashion consultant.
- **Multimodal Context**: Seamless transitions between audio instructions and visual outfit analysis.
- **Premium Tactical HUD**: Animated scanning grid, corner brackets, and **Agent Reasoning Terminal** for high-end sci-fi aesthetic.
- **Haptic Delight**: Tactical physical feedback when taking snapshots or receiving critiques.
- **Deployment**: Connecting via WebSockets provisioned by endpoints running on **Google Cloud Run**.

### Social Loop & Ownership Proof
- **Snapshot Capture**: One-tap frame capture with AR HUD overlays and AI critique text embedded.
- **Native Farcaster Sharing**: Direct integration with `sdk.actions.composeCast` to share "Proof of Style" directly to the feed.
- **Agentic Tipping (Celo)**: Users can tip their AI Stylist in **cUSD** directly from the session. Supports Celo Mainnet and Alfajores with automatic network switching.

## Virtual Try-On Experience

Advanced virtual try-on functionality using IDM-VTON model via Replicate API:

- Upload garment and human images
- AI-powered fitting and visualization
- Body-inclusive visualizations
- Performance optimizations with caching
- Camera integration with image capture
- Animated UI components with Framer Motion
- Responsive design for all screen sizes

## Computer Vision & Fashion Analysis

Using GPT-4o-mini via Replicate API for detailed analysis:

- Outfit rating (1-10 scale)
- Strengths and improvement suggestions
- Style notes and recommendations
- Personalized styling advice

## Design Studio

AI-powered design generation capabilities:

- Text-to-image generation
- Style variation creation
- Design refinement tools
- Export functionality

## Digital Closet Management

NFT-based digital wardrobe management:

- AI-powered automatic tagging
- Metadata management
- Collection organization
- Cross-platform sync

## Social Features & Memory Protocol Integration

Enhanced social aspects with Memory Protocol API:

- **Reward Tracking**: Earn $MEM tokens when users interact with content
- **Social Activity Tracking**: Track and reward social actions like try-ons, mints, and reactions
- **Cross-Platform Discovery**: Find users across different platforms (Farcaster, Twitter, etc.)
- **Wallet Linking**: Connect wallet addresses to Farcaster identities for rewards
- **Identity Graphs**: Comprehensive social data including follower counts and verified status
- **Social Activity Tracking**: Record try-ons, reactions, and NFT mints for rewards

## Worldcoin Mini App Features

Community-driven fashion platform:

- Quick stylist matching
- Style challenges with voting
- Exclusive NFT drops
- Leaderboard and reputation system
- Worldcoin World ID verification for unique accounts
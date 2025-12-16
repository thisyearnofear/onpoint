# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Core Commands
```bash
# Install dependencies
pnpm install

# Start development server (main web app on port 3000)
pnpm dev

# Build all packages and apps for production
pnpm build

# Run linting across all workspaces
pnpm lint

# Type checking across all workspaces
pnpm check-types

# Format code
pnpm format
```

### Web App Specific Commands
```bash
# Run web app dev server with Turbopack
cd apps/web && pnpm dev

# Build web app
cd apps/web && pnpm build

# Start production server
cd apps/web && pnpm start

# Lint web app only
cd apps/web && pnpm lint

# Type check web app only
cd apps/web && pnpm check-types
```

## Required Environment Variables

Create `.env.local` in `apps/web/` with the following:

```bash
# AI Providers (at least one required)
REPLICATE_API_TOKEN=your_replicate_token
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key

# Web3 (required for wallet connections)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# Worldcoin (required for identity features)
NEXT_PUBLIC_WORLDCOIN_APP_ID=your_worldcoin_app_id

# Blockchain RPC
ZETA_RPC_URL=https://zetachain-evm.blockpi.network/v1/rpc/public
```

## Architecture Overview

### Monorepo Structure
This is a **pnpm + Turborepo** monorepo with the following workspaces:

- **apps/web**: Next.js 15 web application (main frontend)
- **apps/chrome-extension**: Chrome extension for fashion capture
- **packages/shared-ui**: Reusable React components (CardEnhanced, ShopGrid, etc.)
- **packages/shared-types**: TypeScript type definitions and fashion data
- **packages/ai-client**: AI service abstractions (Replicate, OpenAI, Gemini)
- **packages/blockchain-client**: Web3 interactions (RainbowKit, Wagmi, Viem, 0xSplits)
- **packages/worldcoin-auth**: Worldcoin identity integration
- **packages/ipfs-client**: IPFS/Filecoin storage integration

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript 5.9
- **Styling**: Tailwind CSS 3.4+, Framer Motion for animations
- **Web3**: RainbowKit, Wagmi, Viem (supports ZetaChain, Base, Celo, Lisk, Arbitrum)
- **AI**: Replicate (IDM-VTON, GPT-4o-mini), OpenAI, Google Gemini
- **State**: Zustand, React Hook Form, Zod validation
- **Storage**: IndexedDB (web), IPFS/Filecoin (decentralized)

## Key Architecture Patterns

### Centralized Fashion Data Layer
All fashion items are defined in a **single source of truth**: `packages/shared-types/src/fashion-data.ts`

- **CANVAS_ITEMS**: Main product catalog array
- **FashionItem interface**: Includes engagement metrics (tryOnCount, mintCount, averageRating)
- Query functions: `getFashionItemBySlug()`, `getFashionItemsByCategory()`, `getCanvasItemsByCategory()`
- African patterns library: `AFRICAN_PATTERNS` with cultural metadata

When adding new fashion items, **only edit this file** - all components automatically consume the data.

### Component Hierarchy (UI Enhancement Pattern)
The codebase uses a premium UI enhancement pattern with these core components:

- **CardEnhanced** (`packages/shared-ui`): Premium product card with like/share buttons, trending badges, quick preview
- **ShopGrid** (`packages/shared-ui`): Smart catalog grid with sorting (trending/rating/price) and category filtering
- **EngagementBadge** (`packages/shared-ui`): Social proof display (Trending/Viral/Popular/New) with animated counters
- **TransitionLink** + **TransitionDetail**: Smooth page morphing using View Transitions API
- **useViewTransition()** hook: Wraps navigation in View Transitions API
- **useEngagementMetrics()** hook: Tracks likes, shares, try-ons (localStorage persisted)

### AI Service Abstraction
AI providers are abstracted through a unified interface in `packages/ai-client`:

- **Base Provider Interface**: Common interface for all AI providers
- **Provider Implementations**: ChromeProvider, GeminiProvider, OpenAIProvider, ReplicateProvider, VeniceProvider, ServerProvider
- **Key AI Features**:
  - Virtual try-on: IDM-VTON via Replicate
  - Fashion critique: GPT-4o-mini with 6 personality modes (luxury, streetwear, sustainable, edina, miranda, shaft)
  - Design generation: DALL-E/Stable Diffusion via Replicate
  - Image analysis: Vision models for outfit analysis

**Personality-based AI critiques** are a core feature - see `packages/ai-client/src/services/personality-service.ts`

### Web3 Integration
Blockchain features are in `packages/blockchain-client`:

- **Wallet Connection**: RainbowKit + Wagmi hooks configured in `apps/web/config/wagmi.ts`
- **Supported Chains**: ZetaChain (primary), Base, Arbitrum, Celo, Celo Alfajores (testnet), Lisk, Sepolia
- **NFT Minting**: ERC-721A contracts with IPFS metadata
- **Royalty Splits**: 0xSplits integration for automated revenue distribution (85% creator, 10% platform, 5% stylist)
- **Smart Contracts**: OnPointNFT, OnPointCollage, OnPointCritique, TokenBoundAccount (ERC-6551), StylistEscrow

### API Routes
All AI and social features use Next.js API routes in `apps/web/app/api/`:

- **AI endpoints**: `/api/ai/virtual-tryon`, `/api/ai/personality-critique`, `/api/ai/analyze`, `/api/ai/generate`, `/api/ai/design`
- **Social endpoints**: `/api/social/feed`, `/api/social/cast`, `/api/social/reaction`, `/api/social/user/[fid]`
- **Webhook**: `/api/webhook` for Farcaster integration

### Animations
The UI uses **9 GPU-accelerated keyframe animations** defined in global CSS:

- scale-pulse, shimmer, bounce-in-up, float, glow, card-tilt, swipe-in-left, gradient-shift, count-up
- Uses `transform` and `opacity` only for performance
- Respects `prefers-reduced-motion` for accessibility

## Key Files to Understand

### Data & Types
- `packages/shared-types/src/fashion-data.ts` - **Single source of truth** for all fashion items
- `packages/shared-types/src/index.ts` - Core TypeScript interfaces (FashionItem, FashionCategory)

### Main App
- `apps/web/app/page.tsx` - Home page
- `apps/web/app/shop/page.tsx` - Product catalog with ShopGrid
- `apps/web/app/style/page.tsx` - Interactive styling canvas
- `apps/web/app/collage/page.tsx` - AI collage creator
- `apps/web/app/layout.tsx` - Root layout with Web3 providers

### Configuration
- `apps/web/config/wagmi.ts` - Web3 wallet configuration
- `turbo.json` - Turborepo pipeline configuration
- `next.config.js` - Next.js configuration (styled-components, image optimization, Origin Trials)

### AI Integration
- `packages/ai-client/src/providers/replicate-provider.ts` - Virtual try-on and vision analysis
- `packages/ai-client/src/services/personality-service.ts` - Personality-based fashion critiques

### Blockchain
- `packages/blockchain-client/src/index.ts` - 0xSplits integration and NFT minting

## Testing Notes

⚠️ **There is no formal test suite yet.** Testing is primarily manual through:
- Running `pnpm dev` and testing features in browser
- Type checking with `pnpm check-types`
- Linting with `pnpm lint`

When adding tests in the future:
- Documentation mentions Vitest (web), Jest (mobile), Playwright (E2E)
- But these are not currently configured

## Important Development Notes

### When Adding Fashion Items
1. Edit `packages/shared-types/src/fashion-data.ts` only
2. Add item to `CANVAS_ITEMS` array with all required fields
3. Ensure images exist in `apps/web/public/assets/`
4. Components automatically consume the new data

### When Integrating UI Components
Follow the pattern in `INTEGRATION.md`:
1. Import from `@repo/shared-ui` (CardEnhanced, ShopGrid, EngagementBadge)
2. Use engagement hooks: `useEngagementMetrics()` from `apps/web/lib/hooks/useEngagementMetrics.ts`
3. Leverage View Transitions API for smooth page morphing

### When Adding AI Features
1. Use the provider abstraction in `packages/ai-client`
2. For server-side AI calls, use API routes in `apps/web/app/api/ai/`
3. For personality critiques, leverage the 6 existing personas
4. Cache responses where possible (see `packages/ai-client/src/utils/cache.ts`)

### When Working with Web3
1. All wallet interactions use Wagmi hooks
2. Chain configuration is in `apps/web/config/wagmi.ts`
3. NFT minting should use `mintNFTWithSplit()` for royalty distribution
4. Test on Celo Alfajores testnet before mainnet deployment

### Deployment
- **Web App**: Vercel with automatic GitHub deployments
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`)
- **Node Version**: Requires Node.js >= 20.19.0 (specified in root `package.json`)
- **Package Manager**: pnpm 10.10.0

## Documentation References

For detailed information, see:
- `docs/ARCHITECTURE.md` - Complete technical architecture
- `docs/FEATURES.md` - User-facing features and functionality
- `docs/AI_INTEGRATION.md` - AI provider integration details
- `docs/ROADMAP.md` - Development timeline and milestones
- `INTEGRATION.md` - UI enhancement integration guide
- `README.md` - Quick start and project overview

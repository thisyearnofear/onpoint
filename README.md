# OnPoint Fashion AI Platform

**AI-powered fashion discovery platform with virtual try-on and digital ownership.**

OnPoint combines AI design generation, AR virtual try-on, blockchain asset ownership, and privacy-preserving identity to create a comprehensive fashion technology solution.

## 🚀 Quick Start

```bash
# Clone and setup
git clone https://github.com/thisyearnofear/onpoint.git
cd onpoint
pnpm install

# Start development
pnpm dev
# → Web app: http://localhost:3000
```

## 🛠️ Environment Variables

To run the application, you need to set up the following environment variables in your `.env.local` file:

```bash
# AI Provider Keys
REPLICATE_API_TOKEN=your_replicate_api_token_here
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
VERTEX_API_KEY=your_vertex_api_key_here # For Gemini Live sessions

# Decentralized Storage
LIGHTHOUSE_API_KEY=your_lighthouse_api_key_here # For Filecoin/IPFS native storage

# Social & Mini App Keys
NEYNAR_API_KEY=your_neynar_api_key_here # For Farcaster/Social features

# WalletConnect Project ID (required for wallet connections)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here

# Worldcoin App ID (required for Worldcoin integration)
NEXT_PUBLIC_WORLDCOIN_APP_ID=your_worldcoin_app_id_here

# ZetaChain/Celo RPC
ZETA_RPC_URL=https://zetachain-evm.blockpi.network/v1/rpc/public
CELO_RPC_URL=https://forno.celo.org
```

You can copy the `.env.example` file to create your `.env.local`:

```bash
cp .env.example .env.local
```

Then edit the `.env.local` file with your actual API keys and credentials.

## 🎯 Core Features

- **Fashion Catalog**: Browse items with trending badges, ratings, and social proof metrics
- **Live AR Stylist**: Real-time voice & vision fashion critique powered by Gemini Live
- **Premium Tactical HUD**: Sci-fi AR overlay with Agent Reasoning terminal and haptic feedback
- **Social Loop**: Snapshot capture and native Farcaster sharing with "Proof of Style"
- **Agentic Tipping**: Tip your AI stylist in cUSD via Celo (Hackathon ready)
- **AI Collage Creator**: Generate personalized fashion designs from images and text
- **Virtual Style Lab**: Interactive try-on with drag-and-drop styling
- **Digital Ownership**: Mint fashion items as NFTs on blockchain
- **Stylist Marketplace**: Connect with professional fashion consultants
- **Enhanced UI**: Premium product cards with like/share actions, view transitions, and micro-animations

## 🏗️ Architecture

```
onpoint/
├── apps/web/              # Next.js main application
├── packages/
│   ├── shared-ui/         # Reusable UI components
│   ├── ai-client/         # AI service integrations
│   ├── blockchain-client/ # Web3 interactions
│   └── worldcoin-auth/    # Identity verification
└── docs/                  # Documentation
```

## 📚 Documentation

Detailed documentation has been consolidated into four main files:

1. **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Technical architecture, system design, and implementation details
2. **[FEATURES.md](docs/FEATURES.md)** - User-facing features and functionality specifications
3. **[AI_INTEGRATION.md](docs/AI_INTEGRATION.md)** - AI provider integration and implementation strategies
4. **[ROADMAP.md](docs/ROADMAP.md)** - Development timeline, milestones, and strategic planning

## 📖 Project Overview

OnPoint is a revolutionary multiplatform ecosystem for personalized fashion discovery and digital ownership. The platform combines cutting-edge AI-powered design generation, AR virtual try-on experiences, and blockchain-based asset ownership to create a comprehensive fashion technology solution.

### Core Value Propositions

- **AI-Powered Fashion Discovery**: Multimodal AI generates personalized designs from images and text prompts
- **Virtual Try-On**: AR/XR technology enables realistic outfit visualization
- **Digital Ownership**: Blockchain-based NFT system for fashion items and designs
- **Stylist Ecosystem**: Connect users with fashion professionals through programmable payments
- **Cross-Platform Sync**: Seamless experience across web, mobile, and mini-app environments

## 🛠️ Development

```bash
pnpm dev        # Start development server
pnpm build      # Build for production
pnpm lint       # Lint code
pnpm format     # Format code
```

## 🏆 Current Status

**Phase 1: MVP Foundation** (9/10 Complete)
- ✅ Web app with Next.js setup
- ✅ AI-powered collage creator
- ✅ Interactive styling canvas
- ✅ Fashion critique system
- ✅ **Live AR Stylist (Gemini Live)**
- ✅ **Farcaster Social Loop (Snapshot + Posting)**
- ✅ **Celo Agentic Tipping (cUSD)**
- ✅ Wallet connection & NFT minting
- ✅ Enhanced UI with engagement features (CardEnhanced, ShopGrid, EngagementBadge)
- 🔄 Mobile app development
- 🔄 Worldcoin mini app

## 🎯 Hackathon Targets

- **Celo Agents for the Real World hackathon** - Q1 2026 (Agentic Tipping via cUSD)
- **Google Chrome Built-in AI Challenge** - Nov 1, 2025 ($70K prize pool)
- **Worldcoin Mini App Dev Rewards** - Ongoing ($100K/week)

## 🔗 Links

- [Live Demo](https://onpoint.app)
- [GitHub](https://github.com/thisyearnofear/onpoint)
- [Discord](https://discord.gg/onpoint)

## 📄 License

MIT License - see LICENSE file for details.
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
# AI Provider Keys (at least one required)
REPLICATE_API_TOKEN=your_replicate_api_token_here
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# WalletConnect Project ID (required for wallet connections)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here

# Worldcoin App ID (required for Worldcoin integration)
NEXT_PUBLIC_WORLDCOIN_APP_ID=your_worldcoin_app_id_here

# ZetaChain RPC (required for blockchain interactions)
ZETA_RPC_URL=https://zetachain-evm.blockpi.network/v1/rpc/public
```

You can copy the `.env.example` file to create your `.env.local`:

```bash
cp .env.example .env.local
```

Then edit the `.env.local` file with your actual API keys and credentials.

## 🎯 Core Features

- **AI Collage Creator**: Generate personalized fashion designs from images and text
- **Virtual Style Lab**: Interactive try-on with drag-and-drop styling
- **AI Fashion Critique**: Get expert styling feedback and suggestions
- **Digital Ownership**: Mint fashion items as NFTs on blockchain
- **Stylist Marketplace**: Connect with professional fashion consultants

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

**Phase 1: MVP Foundation** (7/10 Complete)
- ✅ Web app with Next.js setup
- ✅ AI-powered collage creator
- ✅ Interactive styling canvas
- ✅ Fashion critique system
- ✅ Wallet connection & NFT minting
- 🔄 Mobile app development
- 🔄 Worldcoin mini app
- 🔄 Advanced AI features

## 🎯 Hackathon Targets

- **Google Chrome Built-in AI Challenge** - Nov 1, 2025 ($70K prize pool)
- **Worldcoin Mini App Dev Rewards** - Ongoing ($100K/week)

## 🔗 Links

- [Live Demo](https://onpoint.app)
- [GitHub](https://github.com/thisyearnofear/onpoint)
- [Discord](https://discord.gg/onpoint)

## 📄 License

MIT License - see LICENSE file for details.
# OnPoint Platform Architecture

**Version:** 1.0
**Last Updated:** November 03, 2025
**Status:** Production-Ready Specification

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Web3 & Blockchain Integration](#web3--blockchain-integration)
4. [AI & Machine Learning](#ai--machine-learning)
5. [Data Architecture](#data-architecture)
6. [Security & Privacy](#security--privacy)
7. [Deployment & Operations](#deployment--operations)

---

## System Architecture

### 1.1 Monorepo Structure

```
onpoint-monorepo/
├── apps/
│   ├── web/                      # Next.js 14.4+ Web Application
│   ├── mobile/                   # React Native Mobile App
│   └── worldcoin-mini/           # Worldcoin Mini App
├── packages/
│   ├── shared-ui/                # Shared UI components
│   ├── shared-types/             # TypeScript type definitions
│   ├── blockchain-client/        # Web3 interaction layer
│   ├── ai-client/                # AI service abstractions
│   ├── ipfs-client/              # IPFS/Filecoin integration
│   └── worldcoin-auth/           # Worldcoin SDK wrapper
├── contracts/                    # Solidity smart contracts
├── scripts/                      # Build & deployment scripts
├── docs/                         # Documentation
└── tools/                        # Development tooling
```

### 1.2 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
├─────────────────┬──────────────────┬────────────────────────┤
│   Web App       │   Mobile App     │  Worldcoin Mini App    │
│  (Next.js 14.4+)│  (React Native)  │  (Lightweight Widget)  │
└────────┬────────┴────────┬─────────┴──────────┬─────────────┘
         │                 │                    │
         └─────────────────┼────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                     Service Layer                             │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│   AI APIs    │  IPFS/Filecoin│  ZetaChain  │  Worldcoin SDK  │
│ (GPT-4V)     │   (Storage)   │   (NFTs)    │   (Identity)    │
└──────────────┴──────────────┴──────────────┴─────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                    Infrastructure Layer                       │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│   Vercel     │  Cloudflare  │   IPFS      │   Blockchain     │
│   (Web)      │    (CDN)     │  Gateways   │   (ZetaChain)    │
└──────────────┴──────────────┴──────────────┴─────────────────┘
```

### 1.3 Data Flow Architecture

**User Action → Client Processing → Service Integration → Blockchain/Storage → UI Update**

1. **User Interaction**: User uploads image or creates collage
2. **Client Processing**: Local validation, IndexedDB caching
3. **AI Processing**: GPT-4V multimodal analysis and generation
4. **IPFS Storage**: Metadata and assets pinned to IPFS/Filecoin
5. **Blockchain Transaction**: NFT minted on ZetaChain with IPFS reference
6. **State Synchronization**: Cross-platform sync via blockchain events
7. **UI Update**: Real-time updates across all connected devices

### 1.4 Modular AI Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Service Layer                          │
├─────────────────┬──────────────┬──────────────┬─────────────┤
│  Tagging        │  Critique    │  Generation  │  Sourcing   │
│  Service        │  Service     │  Service     │  Service    │
│  (CLIP/GPT-4V)  │  (GPT-4V)    │  (DALL-E 3)  │  (GPT-4V)   │
└─────────────────┴──────────────┴──────────────┴─────────────┘
         │                │              │              │
         └────────────────┴──────────────┴──────────────┘
                           │
                    ┌──────┴──────┐
                    │   Backend   │
                    │   (FastAPI) │
                    └─────────────┘
```

---

## Technology Stack

### 2.1 Web Application Stack

- **Framework**: Next.js 14.4+ with React 18.x and TypeScript 5.3+
- **Styling**: Tailwind CSS 4.x with Headless UI components
- **State Management**: Zustand with React Hook Form and Zod validation

### 2.2 Mobile Application Stack

- **Framework**: React Native 0.73+ with TypeScript 5.3+
- **Navigation**: React Navigation with NativeWind styling
- **Components**: React Native Paper with Zustand state management
- **AR**: React Native Vision Camera for try-on features

### 2.3 Worldcoin Mini App Stack

- **Framework**: React Native/Web with Worldcoin JS SDK
- **Identity**: World ID Widget for biometric verification

### 2.4 Web3 & Blockchain Stack

- **Wallet**: RainbowKit with Wagmi hooks and Viem client
- **Contracts**: Solidity 0.8.20+ with Hardhat development
- **Network**: ZetaChain (primary) with Celo Alfajores for testing

### 2.5 AI & Machine Learning Stack

- **AI Models**: OpenAI GPT-4V, DALL-E 3, CLIP for image analysis
- **Processing**: LangChain for critique workflows, ONNX/TensorFlow Lite for local inference

### 2.6 Storage & Data Stack

- **Client Storage**: IndexedDB (web), MMKV (mobile)
- **Distributed**: IPFS/Filecoin with Pinata pinning
- **Database**: MongoDB Atlas for vector search and metadata

### 2.7 Development & Testing Stack

- **Package Manager**: pnpm with Turborepo for monorepo
- **Testing**: Vitest (web), Jest (mobile), Playwright (E2E)
- **Code Quality**: ESLint, Prettier, TypeScript

### 2.8 Deployment & Infrastructure

- **Web**: Vercel with Cloudflare CDN
- **Mobile**: App Store/Play Store distribution
- **CI/CD**: GitHub Actions with Sentry monitoring

---

## Web3 & Blockchain Integration

### 3.1 Why ZetaChain

- Native cross-chain interoperability
- Low transaction fees
- Fast finality (5-7 seconds)
- EVM compatibility
- Built-in omnichain messaging
- Native Bitcoin and other chain support

### 3.2 Smart Contract Architecture

**OnPointNFT (ERC-721A)**: Individual fashion items/designs
- Efficient batch minting
- IPFS metadata storage
- Item attribute tracking

**OnPointCollage (ERC-721A)**: Style collages and mood boards
- Composition metadata
- Creator attribution
- Royalty support

**OnPointCritique (ERC-721)**: AI critique reports
- Critique metadata
- Shareable reports
- Verifiable AI analysis

**TokenBoundAccount (ERC-6551)**: Accounts owned by NFTs
- Composable NFT functionality
- NFT-to-NFT interactions
- Programmable ownership

**StylistEscrow**: Programmable payment escrow
- Milestone-based releases
- Dispute resolution
- Fractional payments

### 3.3 Wallet Connection Flow

1. User clicks "Connect Wallet" button
2. RainbowKit modal displays available wallets
3. User selects wallet and approves connection
4. Wagmi hooks manage connection state
5. ZetaChain network automatically configured
6. User address displayed in UI

### 3.4 NFT Minting Flow

1. User prepares content (item, collage, critique)
2. Content uploaded to IPFS via Pinata
3. IPFS hash returned (e.g., `ipfs://QmX...`)
4. Smart contract interaction via Viem
5. Transaction submitted to ZetaChain
6. UI displays pending state with transaction hash
7. On confirmation, NFT displayed in user's collection
8. Metadata indexed for cross-platform sync

### 3.5 IPFS Integration

**Upload Process**:
- File uploaded to Pinata API
- IPFS hash returned
- Metadata stored with pinning service
- Hash referenced in smart contract

**Retrieval Process**:
- Token URI points to IPFS hash
- Gateway resolves content
- Metadata cached locally
- Cross-platform sync via blockchain events

### 3.6 0xSplits Integration for Royalties

**Why 0xSplits**:
- Zero protocol fees, runs at gas cost
- Unstoppable contracts, no maintenance required
- Battle-tested by major platforms
- Multichain support (Base, Optimism, Celo)

**Implementation**:
- Create splits for each NFT mint (85% creator, 10% platform, 5% stylist)
- Set split address as royalty recipient in OnPointNFT contract
- Automated distribution via 0xSplits protocol

---

## AI & Machine Learning

### 4.1 AI Integration Overview

**Primary AI Services**:
- OpenAI GPT-4V for multimodal analysis and critiques
- CLIP for efficient local image tagging
- LangChain for structured critique workflows
- MongoDB Atlas Vector Search for recommendations

**Key Features**:
- Personality-based AI stylist critiques
- Virtual try-on with IDM-VTON model
- Cross-platform AI service abstraction

---

## Data Architecture

### 5.1 Client-Side Storage

**IndexedDB (Web)**:
- Closet items cache
- Draft collages
- User preferences
- Offline access

**MMKV (Mobile)**:
- Fast key-value storage
- Encrypted sensitive data
- Sync queue for pending actions

### 5.2 Server-Side Storage

**IPFS/Filecoin**:
- Immutable content storage
- Decentralized redundancy
- Long-term archival
- Content addressing

**MongoDB Atlas**:
- User profiles
- Booking history
- Vector embeddings
- Analytics data

### 5.3 Blockchain Storage

**ZetaChain**:
- NFT ownership records
- Transaction history
- Smart contract state
- Cross-platform events

### 5.4 Data Synchronization

**Event-Driven Architecture**:
- Listen to blockchain events
- Trigger local updates
- Background sync with exponential backoff
- Conflict resolution (last-write-wins)

## Social Integration & Memory Protocol

### 6.1 Memory Protocol Architecture

**Core Components**:
- **Identity Graphs**: Cross-platform user discovery (Farcaster, Twitter, etc.)
- **Social Activity Tracking**: Record try-ons, mints, reactions for rewards
- **Reward System**: Earn $MEM tokens for social interactions

**Data Flow**:
1. User connects wallet → Fetch identity graph from Memory API
2. User performs action → Record social activity
3. Display social content → Enrich with cross-platform data
4. Distribute rewards → Weekly Merkle Tree claims

**Privacy & Security**:
- Public data indexed automatically
- Private data requires explicit consent
- Zero-knowledge proofs for verification
- Users curate their own identity graphs

---

## Security & Privacy

### 6.1 Authentication & Identity

- **Web**: Wallet-based with RainbowKit
- **Mobile/Mini App**: Worldcoin World ID with zero-knowledge proofs
- **Biometric**: Secure enclave with nullifier hashes for anonymity

### 6.2 Data Protection

- End-to-end encryption for sensitive data
- IPFS decentralized storage with user-controlled deletion
- GDPR compliance and privacy-first approach

### 6.3 Smart Contract Security

- OpenZeppelin libraries with formal verification
- Comprehensive testing (unit, integration, fuzzing)
- Access controls and reentrancy guards

### 6.4 API Security

- Rate limiting and input validation with Zod
- File type verification and size limits

---

## Deployment & Operations

### 7.1 Platform Deployment

- **Web**: Vercel with Cloudflare CDN and automatic GitHub deployments
- **Mobile**: App Store/Play Store with TestFlight beta testing
- **Smart Contracts**: ZetaChain testnet (Alfajores) to mainnet with multi-sig controls

### 7.2 Monitoring & CI/CD

- **Monitoring**: Sentry for errors, Vercel Analytics for performance
- **CI/CD**: GitHub Actions with automated testing and deployments
- **Security**: Blue-green deployments with rollback procedures

---
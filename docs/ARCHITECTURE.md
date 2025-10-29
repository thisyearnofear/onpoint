# OnPoint Platform Architecture

**Version:** 1.0  
**Last Updated:** October 29, 2025  
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

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Framework** | Next.js | 14.4+ | React framework with SSR/SSG |
| **React** | React | 18.x | UI library with Server Components |
| **Language** | TypeScript | 5.3+ | Type-safe development |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS with JIT |
| **UI Components** | Headless UI | 2.x | Accessible component primitives |
| **Bundler** | Turbopack | Built-in | Next.js 14.4+ native bundler |
| **State Management** | Zustand | 4.x | Lightweight state management |
| **Forms** | React Hook Form | 7.x | Performant form handling |
| **Validation** | Zod | 3.x | Schema validation |

### 2.2 Mobile Application Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Framework** | React Native | 0.73+ | Cross-platform mobile framework |
| **Language** | TypeScript | 5.3+ | Type-safe development |
| **Navigation** | React Navigation | 6.x | Native navigation patterns |
| **Styling** | NativeWind | 4.x | Tailwind-style utilities for RN |
| **UI Components** | React Native Paper | 5.x | Material Design components |
| **State Management** | Zustand | 4.x | Shared with web app |
| **AR** | React Native Vision Camera | 3.x | Camera and AR capabilities |
| **Storage** | MMKV | 2.x | Fast key-value storage |

### 2.3 Worldcoin Mini App Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Framework** | React Native / Web | Latest | Platform-specific implementation |
| **Identity SDK** | Worldcoin JS SDK | Latest | Biometric verification |
| **UI** | Worldcoin Design System | Latest | Consistent mini-app styling |
| **Integration** | World ID Widget | Latest | Identity verification widget |

### 2.4 Web3 & Blockchain Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Wallet Connection** | RainbowKit | 2.x | Wallet connection UI |
| **React Hooks** | Wagmi | 2.x | React hooks for Ethereum |
| **Blockchain Client** | Viem | 2.x | TypeScript Ethereum client |
| **Smart Contracts** | Solidity | 0.8.20+ | NFT contracts (ERC-721A, ERC-6551) |
| **Blockchain Network** | ZetaChain | Testnet/Mainnet | Cross-chain smart contract platform |
| **Development** | Hardhat | 2.x | Smart contract development |
| **Testing** | Foundry | Latest | Contract testing framework |

### 2.5 AI & Machine Learning Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Primary AI** | OpenAI GPT-4V | Latest | Multimodal AI generation |
| **Image Generation** | DALL-E 3 | Latest | Text-to-image generation |
| **Local Tagging** | CLIP | Latest | Efficient local image classification |
| **Critique Chain** | LangChain | Latest | Structured AI critique workflows |
| **Fallback (Web)** | ONNX Runtime Web | 1.16+ | Client-side inference |
| **Fallback (Mobile)** | TensorFlow Lite | 2.14+ | Mobile inference |
| **Image Processing** | Sharp (Web) | 0.33+ | Image optimization |
| **Image Processing** | React Native Image | 4.x | Mobile image handling |

### 2.6 Storage & Data Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Client Storage (Web)** | IndexedDB | Native | Browser-based database |
| **Client Storage (Mobile)** | MMKV | 2.x | Fast key-value storage |
| **Service Workers** | Workbox | 7.x | Offline caching strategy |
| **Distributed Storage** | IPFS | Latest | Decentralized content storage |
| **Permanent Storage** | Filecoin | Latest | Long-term storage layer |
| **Metadata** | Pinata / Web3.Storage | Latest | IPFS pinning services |
| **Vector Database** | MongoDB Atlas Vector Search | Latest | Semantic search for recommendations |

### 2.7 Development & Testing Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Package Manager** | pnpm | 8.x | Fast, efficient package management |
| **Monorepo Tool** | Turborepo | 1.11+ | High-performance build system |
| **Testing (Web)** | Vitest | 1.x | Fast unit testing |
| **Testing (Mobile)** | Jest | 29.x | React Native testing |
| **Component Testing** | React Testing Library | 14.x | Component integration tests |
| **E2E Testing** | Playwright | 1.40+ | End-to-end testing |
| **Linting** | ESLint | 8.x | Code quality enforcement |
| **Formatting** | Prettier | 3.x | Code formatting |
| **Type Checking** | TypeScript Compiler | 5.3+ | Static type checking |

### 2.8 Deployment & Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Web Hosting** | Vercel | Next.js optimized hosting with edge functions |
| **CDN** | Cloudflare | Global content delivery and DDoS protection |
| **Mobile Distribution** | App Store / Play Store | Native app distribution |
| **CI/CD** | GitHub Actions | Automated testing and deployment |
| **Monitoring** | Sentry | Error tracking and performance monitoring |
| **Analytics** | Vercel Analytics | Web vitals and user analytics |
| **Blockchain RPC** | Alchemy / QuickNode | Reliable blockchain node access |

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

---

## AI & Machine Learning

### 4.1 OpenAI GPT-4V Integration

**Use Cases**:
- Image analysis and tagging
- Fashion critique generation
- Product recommendation
- Style transfer suggestions

**Implementation**:
- Base64 image encoding
- Structured JSON responses
- Prompt engineering for consistency
- Rate limiting and caching

### 4.2 CLIP for Local Tagging

**Advantages over GPT-4V for tagging**:
- Runs locally (no API calls)
- Faster processing
- Lower cost
- Privacy-preserving

**Implementation**:
- ONNX Runtime Web for browser
- TensorFlow Lite for mobile
- Batch processing for efficiency

### 4.3 LangChain for Critique Chains

**Workflow**:
1. Image analysis chain
2. Structured critique generation
3. Recommendation chain
4. Output formatting

**Benefits**:
- Composable AI workflows
- Error handling and retries
- Token counting and optimization
- Memory management

### 4.4 Vector Search for Recommendations

**MongoDB Atlas Vector Search**:
- Semantic similarity matching
- Outfit recommendation
- Product discovery
- Style matching

**Implementation**:
- Text embeddings via OpenAI
- Image embeddings via CLIP
- Hybrid search (text + image)
- Real-time indexing

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

---

## Security & Privacy

### 6.1 Authentication

**Web App**:
- Wallet-based authentication via RainbowKit
- Session management with JWT
- CSRF protection

**Mobile App**:
- Worldcoin World ID verification
- Biometric authentication (Face ID / Touch ID)
- Secure token storage

**Mini App**:
- Worldcoin World ID as primary identifier
- Zero-knowledge proofs
- One-person-one-account guarantee

### 6.2 Data Privacy

**Biometric Data**:
- Never stored on-chain
- Worldcoin's secure enclave
- Zero-knowledge proofs prevent correlation
- Nullifier hash for anonymity

**User Data**:
- End-to-end encryption for sensitive data
- IPFS content addressing (no central server)
- User-controlled data deletion
- GDPR compliance

### 6.3 Smart Contract Security

**Auditing**:
- Formal verification with Foundry
- OpenZeppelin contract libraries
- Reentrancy guards
- Access control patterns

**Testing**:
- Unit tests for all functions
- Integration tests for workflows
- Fuzzing for edge cases
- Mainnet simulation

### 6.4 API Security

**Rate Limiting**:
- Per-user rate limits
- IP-based throttling
- Exponential backoff for retries

**Input Validation**:
- Zod schema validation
- File type verification
- Size limits
- Malware scanning

---

## Deployment & Operations

### 7.1 Web App Deployment

**Vercel**:
- Automatic deployments from GitHub
- Edge functions for API routes
- Serverless functions
- Environment variable management
- Preview deployments

**Cloudflare**:
- CDN for static assets
- DDoS protection
- Image optimization
- Cache management

### 7.2 Mobile App Deployment

**iOS**:
- App Store distribution
- TestFlight for beta testing
- Code signing and provisioning

**Android**:
- Google Play Store distribution
- Internal testing track
- Staged rollouts

### 7.3 Smart Contract Deployment

**Testnet (ZetaChain Athens)**:
- Development and testing
- Gas-free transactions
- Faucet for test tokens

**Mainnet (ZetaChain)**:
- Production deployment
- Multi-sig wallet for upgrades
- Emergency pause mechanism

### 7.4 Monitoring & Observability

**Error Tracking**:
- Sentry for frontend/backend errors
- Smart contract event monitoring
- Transaction failure alerts

**Performance Monitoring**:
- Vercel Analytics for web vitals
- Mobile app crash reporting
- API response time tracking
- Database query performance

**Logging**:
- Structured logging with timestamps
- Log aggregation and search
- Retention policies
- PII redaction

### 7.5 CI/CD Pipeline

**GitHub Actions**:
- Automated testing on PR
- Type checking with TypeScript
- Linting with ESLint
- Contract testing with Foundry
- Automated deployments on merge

**Deployment Strategy**:
- Blue-green deployments
- Canary releases for mobile
- Rollback procedures
- Database migration scripts

---

## Performance Optimization

### 8.1 Web App Performance

**Target Metrics**:
- Lighthouse Performance Score: 95+
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.5s
- Cumulative Layout Shift: < 0.1
- Core Web Vitals: All "Good" ratings

**Optimization Techniques**:
- Code splitting with dynamic imports
- Image optimization with Next.js Image
- Font optimization with next/font
- Service Worker caching with Workbox
- Incremental Static Regeneration (ISR)
- Link prefetching for anticipated navigation
- IndexedDB for frequently accessed data

### 8.2 Mobile App Performance

**Optimization Techniques**:
- Frame skipping for pose detection
- Model quantization (TensorFlow Lite INT8)
- GPU acceleration for rendering
- Texture caching
- Progressive asset loading
- Memory management and cleanup

### 8.3 AI Service Performance

**Optimization Techniques**:
- Batch processing for embeddings
- Caching of model outputs
- Local inference where possible
- API response caching
- Async processing with queues

---

## Scalability Considerations

### 9.1 Horizontal Scaling

- Stateless API design
- Load balancing with Cloudflare
- Database connection pooling
- Cache layer (Redis for future)

### 9.2 Vertical Scaling

- Efficient algorithms
- Memory optimization
- Database indexing
- Query optimization

### 9.3 Blockchain Scalability

- ZetaChain's native scaling
- Batch transactions where possible
- Layer 2 solutions for future
- Cross-chain optimization

---

## Disaster Recovery

### 10.1 Backup Strategy

- IPFS redundancy via Filecoin
- Database backups (daily)
- Smart contract state snapshots
- Code repository backups

### 10.2 Recovery Procedures

- RTO (Recovery Time Objective): < 1 hour
- RPO (Recovery Point Objective): < 1 day
- Documented runbooks
- Regular disaster recovery drills

---

## Future Enhancements

- Layer 2 scaling solutions
- Advanced AR capabilities
- Real-time collaboration features
- Advanced analytics and insights
- Machine learning model improvements
- Cross-chain interoperability expansion
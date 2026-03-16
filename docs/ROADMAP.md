# OnPoint Development Roadmap

**Version:** 2.1
**Last Updated:** March 16, 2026
**Status:** MVP Beta & Hackathon Submission

## Executive Summary

OnPoint is a revolutionary multiplatform ecosystem for personalized fashion discovery and digital ownership. The platform combines cutting-edge AI-powered design generation, AR virtual try-on experiences, and blockchain-based asset ownership with automated revenue sharing.

### Core Value Propositions

- AI-Powered Fashion Discovery
- Virtual Try-On Experience  
- Digital Ownership via NFTs on Celo
- Automated Revenue Splits (0xSplits)
- Cross-Platform Social Integration (Farcaster + Memory Protocol)

## Development Progress

### Phase 1: MVP Foundation ✅ Complete
**Status**: Core UI & Logic Complete. 

**Completed**:
- ✅ Web app with Next.js setup
- ✅ AI fashion critique with personality-based responses
- ✅ Virtual try-on implementation
- ✅ Basic collage creator
- ✅ Wallet connection (RainbowKit + Wagmi)
- ✅ Farcaster Mini App integration
- ✅ Memory Protocol social features
- ✅ **Enhanced Catalog UI** (Nov 2025)
  - CardEnhanced, ShopGrid, EngagementBadge components
  - Social proof metrics (trending badges, ratings, engagement counts)
  - Like/share social actions with engagement tracking
  - View Transitions API for smooth morphing animations
  - 9 micro-animation effects for delight
  - Mobile-optimized, accessible (WCAG AA)

**Critical Missing for MVP Launch**:
- ❌ ERC-721 Smart contracts for production fashion NFTs
- ❌ Production-grade IPFS pinning service (currently stubbed)
- ❌ End-to-end NFT minting workflow for custom designs

### Implementation Plan for Blockchain Integration (2-3 weeks)

**Week 1: Smart Contracts & 0xSplits Integration**
- Create OnPointNFT contract (ERC-721A) with royalty support
- Integrate 0xSplits for automated royalty distribution (85% creator, 10% platform, 5% stylist)
- Deploy contracts to Celo Alfajores testnet
- Set up contract verification and monitoring

**Week 2: IPFS & Backend APIs**
- Implement IPFS client (Pinata integration) for metadata and image storage
- Create NFT minting API routes with form data handling
- Add metadata upload functionality with structured JSON
- Implement transaction status tracking and error handling

**Week 3: Frontend Integration & Testing**
- Connect frontend to blockchain backend with minting workflow
- Test full try-on → mint → wallet workflow
- Verify 0xSplits royalty distribution mechanics
- Performance optimization and comprehensive error handling

### Phase 2: Blockchain Infrastructure 🚧 In Progress (Breaking Path)

**Timeline**: Ongoing
**Focus**: Transition from stubs to production-ready Celo & ZetaChain interactions.

**突破 (Breakthrough)**: 
- ✅ **Agentic Tipping Protocol**: Implemented real-time cUSD tipping for AI stylists on Celo/Alfajores.
- ✅ **Decentralized Proof of Style**: Integrated **Lighthouse (Filecoin/IPFS)** for immutable snapshot storage. Eligible for Protocol Labs Genesis Hackathon.
- ✅ **Network Switching**: Automatic chain detection and switching for Celo-native transactions.

**Week 1 - Smart Contracts & Deployment**:
- [ ] Create OnPointNFT contract (ERC-721A)
- [ ] Integrate 0xSplits for automated royalty distribution
- [ ] Deploy contracts to Celo Alfajores testnet
- [ ] Set up contract verification and monitoring

**Week 2 - IPFS & Backend APIs**:
- [ ] Implement IPFS client (Pinata integration)
- [ ] Create NFT minting API routes
- [ ] Add metadata upload functionality
- [ ] Implement transaction status tracking

**Week 3 - Integration & Testing**:
- [ ] Connect frontend to blockchain backend
- [ ] Test full mint-to-wallet workflow
- [ ] Verify 0xSplits royalty distribution
- [ ] Performance optimization and error handling

### Phase 2.5: Google Gemini Live Agent Integration ✅ Complete
**Timeline**: Completed March 2026
**Focus**: Add real-time "Live AR Stylist" mode utilizing Gemini Multimodal Live API.

**Completed**:
- ✅ Register Google Cloud Project and configure Vertex AI/GenAI services
- ✅ Implement `GeminiLiveProvider` adhering to `AIProvider` abstractions
- ✅ Deploy secure WebSocket provisioning endpoints to **Google Cloud Run**
- ✅ Build Premium Tactical HUD with **Agent Reasoning Terminal**
- ✅ Implement **Farcaster Social Loop** (Snapshot → Upload → Cast)
- ✅ Implement **Celo Agentic Tipping** (Switch Chain → cUSD Transfer)

### Phase 3: Social & Community Features ✅ Complete

**Deliverables**:
- ✅ Farcaster Mini App integration
- ✅ Memory Protocol identity graphs
- ✅ Social activity tracking and rewards
- ✅ Cross-platform user discovery

### Phase 2: Mobile & Identity ✅ Complete

- React Native mobile app
- AR try-on implementation
- Cross-platform sync

### Phase 3: Mini App & Community ✅ Complete

- Worldcoin Mini App scaffold
- Quick stylist matching
- Style challenges with voting

### Phase 4: Marketplace & Scaling 📅 Post-MVP

**Focus**: Creator economy and marketplace features

**Deliverables**:
- Stylist directory and profiles
- Booking system with calendar integration
- Advanced 0xSplits configurations for complex revenue sharing
- Product sourcing and retail API integration
- Mobile app deployment

## Technical Architecture Updates

### 0xSplits Integration Strategy

**Why 0xSplits over Custom Backend**:
- ✅ **Zero Protocol Fees**: Runs exactly at gas cost
- ✅ **Unstoppable**: Non-upgradable contracts, no maintenance required
- ✅ **Battle-Tested**: Used by Zora, Art Blocks, SuperRare, Sound.xyz
- ✅ **Multichain**: Already deployed on Base, Optimism, Arbitrum + Celo + Lisk
- ✅ **Gas Efficient**: Batched operations and fair distribution costs
- ✅ **Composable**: Each split has payable address for ETH/ERC20

**Implementation Plan**:
```typescript
// 1. Install 0xSplits SDK
npm install @0xsplits/splits-sdk

// 2. Create splits for each NFT mint
const split = await splitsClient.createSplit({
  recipients: [
    { address: creatorAddress, percentAllocation: 85.0 },
    { address: platformAddress, percentAllocation: 10.0 },
    { address: stylistAddress, percentAllocation: 5.0 }
  ],
  distributorFee: 0.1
});

// 3. Set split address as royalty recipient in NFT contract
```

### Celo Integration Benefits

**Why Celo for MVP**:
- ✅ **Low Gas Fees**: ~$0.01 per transaction
- ✅ **Mobile-First**: Built for global accessibility
- ✅ **Stable Coins**: cUSD for predictable pricing
- ✅ **Carbon Negative**: Aligns with sustainable fashion values
- ✅ **Strong Ecosystem**: ReFi and social impact focus

**Deployment Strategy**:
1. **Alfajores Testnet**: MVP testing and validation
2. **Celo Mainnet**: Production launch
3. **Multi-chain**: Expand to Base and Optimism via 0xSplits

## MVP Success Metrics

### Technical Milestones

**Blockchain Infrastructure**:
- [ ] Smart contracts deployed and verified on Celo Alfajores
- [ ] 0xSplits integration functional for royalty distribution
- [ ] IPFS metadata storage working end-to-end
- [ ] NFT minting from web interface to user wallet

**User Experience**:
- [ ] Complete try-on → mint → own workflow under 2 minutes
- [ ] Gas fees under $0.05 per mint on Celo
- [ ] Social sharing to Farcaster working seamlessly
- [ ] Memory Protocol rewards tracking active

**Performance Targets**:
- [ ] Page load times under 2 seconds
- [ ] NFT mint confirmation under 30 seconds
- [ ] IPFS upload under 10 seconds
- [ ] 99.9% uptime for core functionality

## Risk Mitigation

### Technical Risks

**Smart Contract Security**:
- Use OpenZeppelin audited contracts
- Implement emergency pause functionality
- Multi-sig wallet for contract upgrades
- Formal verification with Foundry

**IPFS Reliability**:
- Use Pinata Pro for guaranteed pinning
- Implement backup IPFS providers
- Cache metadata on CDN for performance

**0xSplits Integration**:
- Test thoroughly on Alfajores before mainnet
- Implement fallback royalty mechanism
- Monitor split distributions via subgraph

### Business Risks

**User Adoption**:
- Focus on Farcaster community for initial users
- Leverage Memory Protocol rewards for engagement
- Partner with fashion creators for content

**Market Competition**:
- Emphasize unique AI + social + blockchain combination
- Build strong creator community early
- Focus on mobile-first, accessible experience

## Post-MVP Roadmap

### Phase 5: Creator Economy (Q1 2026)

**Advanced 0xSplits Features**:
- Waterfall splits for tiered royalties
- Vesting schedules for long-term creators
- Liquid splits for tradeable revenue shares

**Marketplace Features**:
- Creator storefronts with custom splits
- Collaborative design splits
- Community-driven curation with reward splits

### Phase 5: African Differentiation (Q1 2025)

**Cultural Integration**:
- [x] African Pattern Library Integration
- [x] African Inspiration Toggle in Design Studio
- [x] Cultural Context for AI-Generated Designs
- [ ] Web Search for African Fashion Trends (Tavily API)
- [ ] Virtual Try-On with African Representation

**AI Training Initiative**:
- [ ] Train AI model on 15,000+ African fashion images using cloud GPUs
- [ ] Implement African-specific image classification (styles, patterns)
- [ ] Develop African fashion similarity search
- [ ] Enable trend prediction for African markets
- [ ] Enhance virtual try-on with African representation

**Designer Ecosystem**:
- African Designer Collaboration API
- Cultural Preservation NFT Collections
- Pan-African Payment Integration

### Phase 6: Cross-Chain Expansion (Q2 2026)

**Multi-Chain Strategy**:
- Deploy to Base for Coinbase ecosystem
- Optimism for Ethereum L2 benefits
- Arbitrum for DeFi integrations
- Maintain Celo as primary for accessibility

**Advanced Features**:
- Cross-chain NFT bridging
- Multi-chain royalty aggregation
- Unified identity across chains via Memory Protocol
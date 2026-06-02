# Proof of Ship - AI Agent Track Submission

## Project Information

**Project Name:** OnPoint - AI-Powered Personal Styling Agent
**Website:** https://beonpoint.netlify.app
**GitHub:** https://github.com/thisyearnofear/onpoint
**Live Demo:** https://beonpoint.netlify.app

## Agent Identity

### Agent's Wallet Address on Celo
```
0x5b33E63440e95289207120B94da78CE22F9D24fB
```

### Link to Agent on 8004.io
```
https://8004scan.io/agents/9177
```

### ERC-8004 Registration Details
- **Agent ID:** 9177
- **Registry Contract:** 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
- **Chain:** Celo Mainnet (42220)
- **Registration TX:** 0x536940e8b9167776a7e2951c9f427ee0a519736f4470cf10065e127b0d14abe3
- **Registered At:** 2026-05-25
- **Agent URI:** https://beonpoint.netlify.app/.well-known/agent.json

### Self Agent ID NFT
- **Self Agent ID:** onpoint-agent-9177
- **Status:** Mock/demo mode (Self Protocol integration implemented, awaiting API key for production)
- **Explanation:** "Self Protocol integration is fully implemented with registration and verification flows. Currently using mock registration for demo purposes. Production deployment will activate full Self API key for on-chain verification."

## Agent Capabilities

### What the Agent Does

OnPoint is an autonomous AI fashion stylist that operates on a "Perceive → Reason → Act" loop:

1. **Perceives** - Real-time video analysis of user outfits using AI vision models (Google Gemini, Venice AI)
2. **Reasons** - Style compatibility analysis with transparent decision-making
3. **Acts** - Personalized recommendations, product discovery, and autonomous purchases

### Key Features

- **Live AR Styling** - Real-time video analysis with AI feedback
- **Spending Controls** - Configurable autonomy thresholds ($5 auto-execute, larger requires approval)
- **Transparent Decisions** - Every suggestion includes visible reasoning trail
- **Autonomous Shopping** - Agent browses web for products when internal catalog doesn't match
- **Secure Token Vault** - Auth0 Token Vault for secure API access (RFC 8693)
- **NFT Minting** - Style moments minted on Celo as ERC-721A NFTs

### Onchain Activity

- **Smart Contract:** 0x8e0a3BcF07Ec8133408A3837DD2DCe398A42f576 (OnPointNFT)
- **Chain:** Celo Mainnet
- **Wallet:** 0x5b33E63440e95289207120B94da78CE22F9D24fB
- **Balance:** 3 CELO (funded and ready)

## Technical Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **AI:** Venice AI, Google Gemini Live, OpenAI GPT-4V
- **Blockchain:** Celo, Base, Ethereum, Polygon (via viem + wagmi)
- **Auth:** Auth0 Token Vault (RFC 8693 Token Exchange)
- **Storage:** IPFS/Filecoin (Lighthouse), Redis (Upstash)

## Proof of Ship Eligibility

✅ **Deployed on Celo Mainnet** with verified smart contracts
✅ **Open Source** (MIT license, public GitHub repository)
✅ **AI Agent** with autonomous decision-making and spending controls
✅ **B2C App** focused on user onboarding and real utility
✅ **MiniPay Hook** implemented for MiniPay compatibility
✅ **ERC-8004 Registered** on Celo Mainnet
✅ **Agent Wallet** funded and active on-chain

## MiniPay Integration

- Auto-detection of MiniPay environment
- Hidden connect wallet button in MiniPay
- Fee abstraction support (USDm, cUSD, USDT)
- Legacy transaction support (no EIP-1559)

## Resources

- **8004scan Profile:** https://8004scan.io/agents/9177
- **Celoscan Wallet:** https://celoscan.io/address/0x5b33E63440e95289207120B94da78CE22F9D24fB
- **Smart Contract:** https://celoscan.io/address/0x8e0a3BcF07Ec8133408A3837DD2DCe398A42f576
- **GitHub Repository:** https://github.com/thisyearnofear/onpoint

## Next Steps for Judges

1. Visit https://8004scan.io/agents/9177 to view agent registration
2. Check on-chain activity on Celoscan
3. Review GitHub repository for code quality and activity
4. Test MiniPay integration on mobile device
5. Experience live AR styling session on the demo

## Contact

- **GitHub:** https://github.com/thisyearnofear/onpoint
- **Telegram:** https://t.me/proofofship
- **Twitter:** https://x.com/CeloDevs

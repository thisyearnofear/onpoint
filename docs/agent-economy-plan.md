# Agent Economy Platform - Implementation Plan (WDK-Focused)

## Executive Summary

Transform OnPoint into an **Agent Economy Platform** by extending the existing Tether WDK wallet service. No new smart contracts needed - we leverage WDK for agent wallets and handle business logic at the API layer.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AGENT ECONOMY PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API Layer                                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │ Spending    │  │ Approval    │  │ Agent       │  │ Affiliate   │ │   │
│  │  │ Limits      │  │ Workflows   │  │ Registry    │  │ Tracking    │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Tether WDK Service                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │ Agent       │  │ ERC-20      │  │ Contract    │  │ Multi-chain │ │   │
│  │  │ Wallets     │  │ Transfers   │  │ Calls       │  │ Support     │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Existing Contracts                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │ OnPointNFT  │  │ cUSD/CELO   │  │ 0xSplits    │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Agent as First-Class User ✅ IMPLEMENTED

### 1.1 Enhanced Agent Wallet Service ✅

**File:** `apps/web/lib/services/agent-wallet.ts`

Tether WDK integration with multi-chain support:

```typescript
// Uses @tetherto/wdk and @tetherto/wdk-wallet-evm
// Supports: Celo, Base, Ethereum, Polygon
// Seed phrase → self-custodial agent wallet
```

```typescript
// ERC-20 Token Support
async getERC20Balance(chain, tokenAddress): Promise<ERC20Balance>
async approveToken(chain, tokenAddress, spender, amount): Promise<TxResult>
async transferToken(chain, tokenAddress, to, amount): Promise<TxResult>

// Contract Interactions (for existing OnPointNFT)
async mintNFT(chain, to, metadataUri, royaltyRecipient, royaltyBps): Promise<MintResult>

// Agent Operations
async tipAgent(chain, recipient, amount, message?): Promise<TxResult>
```

### 1.2 Spending Limits & Approvals (API Layer) ✅ IMPLEMENTED

**File:** `apps/web/lib/middleware/agent-controls.ts`

882-line middleware with Redis persistence, autonomy thresholds, and approval workflows. Uses viem's parseEther for precision-safe wei conversions.

```typescript
// Off-chain spending limits (stored in DB/Redis)
interface SpendingLimit {
  agentId: string;
  actionType: "tip" | "purchase" | "mint";
  dailyLimit: number; // in wei
  perActionLimit: number;
  spentToday: number;
  lastReset: Date;
}

// Check if action is allowed
async function checkSpendingLimit(
  agentId,
  actionType,
  amount,
): Promise<boolean>;
async function recordSpending(agentId, actionType, amount): Promise<void>;

// Approval workflow
async function requestApproval(
  agentId,
  action,
  details,
): Promise<ApprovalRequest>;
async function approveAction(approvalId, userSignature): Promise<boolean>;
```

### 1.3 Agent Registry (Off-Chain)

**File:** `apps/web/lib/services/agent-registry.ts` (NEW)

```typescript
// Store in Supabase/Postgres or IPFS
interface AgentProfile {
  id: string;
  name: string;
  type: "stylist" | "shopper" | "brand";
  walletAddress: string;
  metadata: AgentMetadata;
  reputation: number; // 0-1000
  totalEarnings: string;
  totalTransactions: number;
  services: AgentService[];
  createdAt: Date;
}

// CRUD operations
async function registerAgent(profile): Promise<AgentProfile>;
async function getAgent(id): Promise<AgentProfile>;
async function updateReputation(agentId, rating): Promise<void>;
async function discoverAgents(filters): Promise<AgentProfile[]>;
```

### 1.4 New API Routes ✅ IMPLEMENTED

| Route                  | Method | Purpose                    |
| ---------------------- | ------ | -------------------------- |
| `/api/agent/mint`      | POST   | Mint NFT on behalf of user |
| `/api/agent/tip-agent` | POST   | Agent-to-agent tipping     |
| `/api/agent/purchase`  | POST   | Execute purchase           |
| `/api/agent/discovery` | GET    | Discover agents by type    |
| `/api/agent/approval`  | POST   | Request/approve actions    |

### 1.5 New UI Components ✅ IMPLEMENTED

| Component                | Purpose                         |
| ------------------------ | ------------------------------- |
| `AgentApprovalModal.tsx` | User approves agent actions     |
| `AgentMarketplace.tsx`   | Discover and hire agents        |
| `AgentPermissions.tsx`   | Configure agent spending limits |

---

## Phase 2: Human+Agent Marketplace ✅ IMPLEMENTED

### 2.1 Shopping Cart ✅

**New Files:**

- `apps/web/lib/store/cart-store.ts` - Zustand store
- `apps/web/components/Shop/CartDrawer.tsx` - Cart UI
- `apps/web/components/Shop/Checkout.tsx` - Checkout flow

**Features:**

- Persistent cart (localStorage)
- Agent recommendations highlighted
- Affiliate attribution tracking

### 2.2 Checkout Flow

**New File:** `apps/web/app/api/checkout/route.ts`

```typescript
// Affiliate commission structure
const COMMISSIONS = {
  seller: 85%,
  platform: 10%,
  affiliate: 3%,   // If referred by affiliate
  agent: 2%,       // If recommended by agent
};
```

### 2.3 Product Catalog

**Expand:** `packages/shared-types/src/fashion-data.ts`

- Add 20+ demo products
- Add affiliate metadata
- Add brand information

---

## Phase 3: Brand Partnerships

### 3.1 Brand API

**New Routes:**

- `/api/brand/register` - Register as brand partner
- `/api/brand/campaigns` - Manage ad campaigns
- `/api/brand/commissions` - Track affiliate commissions

### 3.2 Brand UI

**New Components:**

- `BrandDashboard.tsx` - Brand management portal
- `CampaignManager.tsx` - Create/manage campaigns
- `CommissionTracker.tsx` - View earnings

---

## Phase 4: Agent-to-Agent Economy

### 4.1 Agent Services Marketplace

**New Routes:**

- `/api/marketplace/services` - List/discover services
- `/api/marketplace/orders` - Purchase agent services
- `/api/marketplace/reviews` - Leave reviews

### 4.2 Marketplace UI

**New Components:**

- `ServiceGrid.tsx` - Browse agent services
- `ServiceDetail.tsx` - Service details and booking
- `AgentReviews.tsx` - Review display

---

## Implementation Plan

### Week 1: Core Agent Capabilities

| Day | Task                             | Files                                      |
| --- | -------------------------------- | ------------------------------------------ |
| 1   | ERC-20 support in wallet service | `agent-wallet.ts`                          |
| 2   | Agent minting (reuse OnPointNFT) | `agent-wallet.ts`, `/api/agent/mint`       |
| 3   | Spending limits middleware       | `agent-controls.ts`                        |
| 4   | Approval workflow                | `/api/agent/approval`, `ApprovalModal.tsx` |
| 5   | Agent registry service           | `agent-registry.ts`                        |

### Week 2: Shopping Experience

| Day | Task                      | Files             |
| --- | ------------------------- | ----------------- |
| 1   | Cart store (Zustand)      | `cart-store.ts`   |
| 2   | Cart UI (drawer)          | `CartDrawer.tsx`  |
| 3   | Checkout API              | `/api/checkout`   |
| 4   | Checkout UI               | `Checkout.tsx`    |
| 5   | Product catalog expansion | `fashion-data.ts` |

### Week 3: Polish & Integration

| Day | Task                         | Files                   |
| --- | ---------------------------- | ----------------------- |
| 1   | Agent-to-agent tipping       | `/api/agent/tip-agent`  |
| 2   | Agent marketplace API        | `/api/marketplace/*`    |
| 3   | Agent marketplace UI         | `ServiceGrid.tsx`       |
| 4   | Wire everything in dashboard | `TacticalDashboard.tsx` |
| 5   | Testing and fixes            | -                       |

---

## Key Files Reference

### Files to Modify

| File                                                  | Changes                                 |
| ----------------------------------------------------- | --------------------------------------- |
| `apps/web/lib/services/agent-wallet.ts`               | Add ERC-20, NFT minting, contract calls |
| `apps/web/app/api/agent/tip/route.ts`                 | Integrate with wallet service           |
| `apps/web/components/Agent/TipModal.tsx`              | Real wallet integration                 |
| `apps/web/components/VirtualTryOn/MintLookButton.tsx` | Use agent wallet                        |
| `apps/web/components/Dashboard/TacticalDashboard.tsx` | Add cart, marketplace                   |
| `packages/shared-types/src/fashion-data.ts`           | More products                           |

### New Files to Create

| File                                             | Purpose                    |
| ------------------------------------------------ | -------------------------- |
| `apps/web/lib/middleware/agent-controls.ts`      | Spending limits, approvals |
| `apps/web/lib/services/agent-registry.ts`        | Agent profiles, reputation |
| `apps/web/lib/store/cart-store.ts`               | Shopping cart state        |
| `apps/web/app/api/agent/mint/route.ts`           | NFT minting API            |
| `apps/web/app/api/agent/purchase/route.ts`       | Purchase execution API     |
| `apps/web/app/api/agent/discovery/route.ts`      | Agent discovery API        |
| `apps/web/app/api/checkout/route.ts`             | Checkout with commissions  |
| `apps/web/app/api/products/route.ts`             | Product catalog API        |
| `apps/web/components/Agent/ApprovalModal.tsx`    | Approval UI                |
| `apps/web/components/Agent/AgentMarketplace.tsx` | Agent discovery UI         |
| `apps/web/components/Shop/CartDrawer.tsx`        | Cart drawer                |
| `apps/web/components/Shop/Checkout.tsx`          | Checkout flow              |

---

## Existing Contracts (Reuse)

| Contract    | Address                                      | Usage            |
| ----------- | -------------------------------------------- | ---------------- |
| OnPointNFT  | `0xdb65806c994C3f55079a6136a8E0886CbB2B64B1` | Agent mints NFTs |
| cUSD (Celo) | `0x765DE8164458C172EE097029dfb482Ff182ad001` | ERC-20 payments  |
| CELO        | Native                                       | Native payments  |
| 0xSplits    | Via mintNFTWithSplit                         | Revenue sharing  |

---

## Data Storage

| Data              | Storage           | Why                  |
| ----------------- | ----------------- | -------------------- |
| Agent profiles    | Supabase/Postgres | Queryable, real-time |
| Agent reputation  | Supabase/Postgres | Track over time      |
| Spending limits   | Redis/Supabase    | Fast checks          |
| Pending approvals | Redis             | Ephemeral            |
| Cart              | localStorage      | Client-side          |
| Product catalog   | Supabase + static | Flexible             |
| Commissions       | Supabase          | Audit trail          |

---

## Phase 5: Agent Discovery Engine (`agent-web-bridge`)

Autonomous web browsing and API aggregation for style discovery. When the internal catalog lacks a match, the platform utilizes a **3-Tier Discovery Engine**:

- **Tier 1: Internal Catalog** - Instant, curated results from `CANVAS_ITEMS`.
- **Tier 2: Purch Network** - Global API aggregate with 1B+ products via headless commerce.
- **Tier 3: Browser Use Cloud** - Autonomous deep-web search with real-time "Watch Live" UI.
- **Structured Data**: Extracts `ItemData` (Price, URL, Source) using Pydantic V2 models.
- **Real-time Live View**: Surfaces a `liveUrl` allowing users to watch the agent navigate in real-time.

### 5.2 Collaborative Commerce ✅

**File:** `apps/web/app/api/agent/purchase/route.ts`

- Handshakes between Next.js and the Python Bridge.
- Updates existing suggestions with real-world results.
- Maintains the $5 autonomy threshold for web searches ($0.10/action).

---

## Success Criteria

- [x] Agent can receive tips (via WDK agent wallet — `/api/agent/tip`)
- [x] Agent can autonomously execute purchases (via `/api/agent/purchase`)
- [x] Agent can mint NFTs on behalf of users (via `/api/agent/mint`)
- [x] Agent can discover external products on the web (Agent Web-Bridge)
- [x] User can observe agent browsing in real-time (Watch Live UI)
- [ ] Agent can tip other agents (not yet implemented)
- [x] Users can see agent approval requests (AgentApprovalModal)
- [x] Shopping cart with agent recommendations (CartDrawer + product catalog)
- [x] Checkout with affiliate commissions (85/10/3/2 split via `/api/agent/checkout`)
- [ ] Agent discovery and reputation system (Phase 3 — not yet implemented)

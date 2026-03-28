# OnPoint — PL Genesis: Frontiers of Collaboration

> **Track:** AI & Autonomous Infrastructure  
> **Challenge:** Verifiable Agent Logs (IPFS/Filecoin Integration)  
> **Status:** Submission Ready

## The Frontier: Verifiable Agency

In the "Agentic Web," autonomy without accountability is dangerous. OnPoint addresses this by providing **Verifiable Agency**: a system where every autonomous agent decision is cryptographically signed and stored on decentralized infrastructure.

### 1. Cryptographic Attestation (Tether WDK)
The agent operates a self-custodial wallet via **Tether WDK**. Every recommendation (shopping, minting, tipping) is signed by the agent's wallet using `AgentWalletService.signMessage()`. This proves the decision originated from our specific agent identity (#35962).

### 2. Decentralized Audit Trails (IPFS/Filecoin)
Instead of storing logs in a private database, OnPoint uploads every agent action to **IPFS/Filecoin** via **Lighthouse**. These logs include the decision context, the model used (Venice Mistral), and the agent's signature.
- **CID Persistence**: Every agent suggestion in the database now carries a `verifiableLogCid`.
- **Tamper-Proof**: Decisions cannot be altered or deleted after the fact.

### 3. Transparent Human-Agent Collaboration
Our **Suggestion Toast UI** includes a "Verifiable Receipt" badge. Users can click to view the raw, signed log on an IPFS gateway, providing total transparency into the agent's reasoning.

---

## Alignment with Themes

### AI/AGI & Robotics (Verifiable Intelligence)
We ground our AI's "thoughts" in open, trusted data. By storing decision logs on Filecoin, we create a permanent, verifiable history of agent intelligence.

### Web3 & Digital Human Rights
We combine **Venice AI** (privacy-preserving inference) with **IPFS** (sovereign data). User outfit images are processed in real-time with zero retention, while the resulting agent decisions are stored on decentralized infrastructure under the user's awareness.

---

## Technical Implementation

- **Verifiable Logs**: `apps/web/lib/services/verifiable-agent-service.ts`
- **Agent Signing**: `apps/web/lib/services/agent-wallet.ts`
- **Registry Integration**: `apps/web/lib/services/agent-registry.ts`
- **IPFS Storage**: `@repo/ipfs-client` (Lighthouse)

---

## Verification

Every suggestion created via `/api/agent/suggestion` now produces a log like:
`ipfs://QmVerifiableReceipt...`

**Example Receipt Structure:**
```json
{
  "version": "1.0.0",
  "agentId": "onpoint-stylist",
  "userId": "0xUser...",
  "action": { "type": "purchase", "amount": "5 cUSD" },
  "context": { "modelId": "venice-mistral-31-24b", "timestamp": 1711612800 },
  "attestation": {
    "signer": "0xAgentWallet...",
    "signature": "0xSignature..."
  }
}
```

# ADR 0006: 0G Compute Integration for African Fashion Fine-Tuning

- **Status:** Accepted — 2026-06-15
- **Date:** 2026-06-15
- **Deciders:** OnPoint core
- **Supersedes:** —
- **Related:** [ADR 0001 — Backend-First Autonomy](./0001-backend-first-autonomy.md), [ADR 0003 — Storage Strategy](./0003-storage-strategy.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [ROADMAP.md](../ROADMAP.md)

## Context

OnPoint is participating in the 0G Bridge Buildathon (June 13 – August 21, 2026) with a focus on **African fashion differentiation**. The current AI providers (Venice, Gemini, OpenAI) are general-purpose models that lack specialized knowledge of African fashion patterns (Ankara, Kente, Adire, Bogolan, Shweshwe).

**Problem**: When users upload photos of African fashion, current models:
- Misidentify patterns (e.g., calling Ankara "floral print")
- Miss cultural context (e.g., not recognizing Kente as Ghanaian)
- Provide generic styling advice that doesn't respect cultural significance
- Cannot distinguish between similar patterns from different regions

**Opportunity**: 0G Compute offers decentralized GPU infrastructure for verifiable AI inference and fine-tuning. By fine-tuning a model on African fashion data, OnPoint can:
- Achieve >90% accuracy on African pattern classification
- Provide culturally-aware styling recommendations
- Differentiate from competitors (Stitch Fix, ASOS AI, etc.)
- Align with "African Differentiation" roadmap item (Phase Post-MVP)
- Record TEE-attested inferences on-chain for verifiable audit trails (ADR 0005)

## Verified Catalog (2026-06-15)

The 0G Router (https://router-api.0g.ai/v1) is OpenAI Chat Completions compatible. The live catalog was probed directly with `curl -H "Authorization: Bearer *** /v1/models` and the vision-capable models available for inference today are:

| Model | Modalities | Context | Output | Input $/1M | Output $/1M | Verifiability |
|-------|-----------|---------|--------|------------|-------------|---------------|
| **qwen3-vl-30b** (default) | text + image → text | 262K | 32K | $0.02 | $0.19 | TeeTLS / TDX / dstack |
| **minimax-m3** | text + image + video → text | 1M | 131K | Free (0G Bridge promo, Jun 15–18 2026) | Free | TeeTLS / TDX / dstack |
| **0gm-1.0-35b-a3b** | text + image → text | 262K | 32K | $0.03 | $0.19 | TeeML / TDX / dstack |

`qwen3-vl-30b` is the workhorse: cheapest vision-capable entry, 1.5–1.7s latency on the live Router, JSON-mode output works, accepts `image_url` content blocks (verified by direct probe).

**Predefined fine-tunable models** (text-only, per docs 2026-06):
- `Qwen2.5-0.5B-Instruct` — 0.5 0G / 1M tokens, ~100 MB LoRA
- `Qwen3-32B` — 4 0G / 1M tokens, ~900 MB LoRA

There is no predefined **vision** fine-tunable model on 0G. The 0G Router exposes vision-capable inference models (above), but the predefined fine-tuning catalog is text-only. Custom vision providers may exist — discoverable via `0g-compute-cli fine-tuning list-providers` — but they are not in the published predefined list.

## Decision

Integrate **0G Compute** as a new AI provider for African fashion fine-tuning, following the **Enhancement-First** principle:

1. **Add, don't replace**: 0G Compute is a new provider in the existing `AIProvider` abstraction
2. **Enhance existing**: The `ai-client` package already supports multiple providers — 0G is just another implementation
3. **Fallback-safe**: If 0G Compute is unavailable, fall back to Venice/Gemini/OpenAI

### Architecture

```
╭──────────────────────────────────────────────────────────────╮
│  User uploads African fashion photo                          │
╰────────────────────────────┬─────────────────────────────────╯
                             │
╭────────────────────────────▼─────────────────────────────────╮
│  ai-client provider fallback chain                           │
│  Venice → 0G Compute → Gemini → OpenAI                      │
│  (free)   (fine-tuned)  (premium) (fallback)                │
╰────────────────────────────┬─────────────────────────────────╯
                             │
╭────────────────────────────▼─────────────────────────────────╮
│  0G Compute Provider                                         │
│  ╭────────────────────────────────────────────────────────╮  │
│  │ packages/0g-compute/src/index.ts                      │  │
│  │ - Fine-tuning pipeline (Wave 2)                       │  │
│  │ - Model registry on 0G mainnet (Wave 3)               │  │
│  │ - Inference endpoint (Wave 3)                         │  │
│  ╰────────────────────────────────────────────────────────╯  │
╰──────────────────────────────────────────────────────────────╯
```

### Data Pipeline

```
╭──────────────────────────────────────────────────────────────╮
│  African Fashion Dataset                                      │
│  - 15K+ images from open sources (Wikimedia, Unsplash, etc.) │
│  - Categories: Ankara, Kente, Adire, Bogolan, Shweshwe      │
│  - Metadata: cultural context, region, occasion              │
╰────────────────────────────┬─────────────────────────────────╯
                             │
╭────────────────────────────▼─────────────────────────────────╮
│  0G Compute Fine-Tuning                                       │
│  - Base model: Qwen VL or similar vision model              │
│  - Training: Supervised fine-tuning on African fashion      │
│  - Output: Fine-tuned model registered on 0G mainnet        │
╰────────────────────────────┬─────────────────────────────────╯
                             │
╭────────────────────────────▼─────────────────────────────────╮
│  Model Registry (0G Chain)                                    │
│  - Model ID, version, performance metrics                   │
│  - On-chain attestation for verifiability                    │
│  - Used by 0G Compute provider for inference                 │
╰──────────────────────────────────────────────────────────────╯
```

## Alignment with Core Principles

| Principle | Application |
|---|---|
| **ENHANCEMENT FIRST** | 0G Compute is a new `AIProvider` implementation — not a new abstraction. The existing `ai-client` package handles provider selection, fallback, and caching. |
| **CONSOLIDATION** | One provider interface, one fallback chain, one model registry. No new API surface for the web app. |
| **PREVENT BLOAT** | Fine-tuning pipeline is a separate worker (`packages/0g-compute/`), not embedded in the web app. Dataset collection is a one-time script, not a running service. |
| **DRY** | Model inference uses the existing `AIProvider.analyzeOutfit()` interface. No new API routes needed. |
| **CLEAN** | 0G Compute runs on Hetzner worker (ADR 0001), not on Netlify edge. Dataset and fine-tuning are backend concerns. |
| **MODULAR** | 0G provider is swappable — can be disabled via `0G_COMPUTE_ENABLED=false` env var. Falls back to other providers seamlessly. |
| **PERFORMANT** | Fine-tuned model cached locally on Hetzner. Inference only calls 0G Compute when local cache is cold. |
| **ORGANIZED** | New package `packages/0g-compute/` follows existing `packages/ai-client/` pattern. Domain-driven: African fashion is a vertical, not a feature. |

## Technical Implementation

### New Package: `packages/0g-compute`

```typescript
// packages/0g-compute/src/index.ts
export interface ZeroGComputeConfig {
  apiKey: string;
  baseUrl: string;
  modelRegistryAddress?: string; // 0G Chain contract
}

export interface TrainingJob {
  id: string;
  status: "pending" | "training" | "completed" | "failed";
  modelId?: string;
  metrics?: {
    accuracy: number;
    loss: number;
    epochs: number;
  };
}

export interface ZeroGComputeClient {
  fineTune(config: FineTuneConfig): Promise<TrainingJob>;
  inference(modelId: string, input: VisionInput): Promise<CritiqueResponse>;
  status(jobId: string): Promise<TrainingStatus>;
  listModels(): Promise<Model[]>;
}
```

### Provider Integration: `packages/ai-client`

```typescript
// packages/ai-client/src/providers/zero-g-provider.ts
import { ZeroGComputeClient } from "@repo/0g-compute";

export class ZeroGProvider implements AIProvider {
  name = "0G Compute";
  private compute: ZeroGComputeClient;

  constructor(config: ZeroGComputeConfig) {
    this.compute = createZeroGComputeClient(config);
  }

  async analyzeOutfit(input: VisionInput): Promise<CritiqueResponse> {
    // Check if input is African fashion (vertical detection)
    if (this.isAfricanFashion(input)) {
      const modelId = await this.getBestModel(input.verticals);
      return this.compute.inference(modelId, input);
    }
    // Fall back to base model for non-African fashion
    return this.compute.inference("base-vision-model", input);
  }

  private isAfricanFashion(input: VisionInput): boolean {
    // Quick heuristic: check if image contains patterns matching African textiles
    // This avoids unnecessary fine-tuned model calls
    return input.verticals?.some(v => 
      ["ankara", "kente", "adire", "bogolan", "shweshwe"].includes(v)
    ) ?? false;
  }
}
```

### Fallback Chain Update

```typescript
// apps/web/lib/utils/provider-fallback.ts (update)
import { ZeroGProvider } from "@repo/ai-client/providers/zero-g-provider";

export const FALLBACK_CHAIN: AIProvider[] = [
  veniceProvider,      // Free tier, fast (~3s)
  zeroGProvider,       // 0G Compute (qwen3-vl-30b, TEE-attested, ~1.5s)
  geminiProvider,      // Premium, real-time streaming (WebSocket)
  openaiProvider,      // Final fallback
];

// ZeroG provider is conditionally added based on env var
if (process.env.NEXT_PUBLIC_ZERO_G_ENABLED === "true") {
  FALLBACK_CHAIN.splice(1, 0, zeroGProvider);
}
```

**Server-side analyze chain** (apps/api/routes/ai-agent.js): Venice → 0G → Replicate → Azure. 0G is positioned second because the TEE attestation gives us a stronger receipt surface than Replicate / Azure, and the default model is the cheapest vision-capable entry on the live catalog.

**Live AR session factories** (packages/ai-client/src/providers/live-session-factories.ts): each free-tier factory's `fallbackChain` now inserts `0g` between the last free provider and `gemini`. 0G is HTTP-only, so it cannot replace the WebSocket premium terminal; it slots in as a polling-based option that the chain visits before paying for Gemini Live.

## Re-Scoped Fine-Tuning Thesis

The original ADR proposed fine-tuning a Qwen-VL vision model. The live 0G catalog exposes only **text-only** predefined fine-tunable models (Qwen2.5-0.5B-Instruct, Qwen3-32B). We re-scope as follows:

- **Wave 1–2 (now)**: Fine-tune `Qwen3-32B` on structured text descriptions of African garments (cultural context, occasion, region, pattern names, materials). Use the fine-tuned Qwen3-32B as the **chat** model (`chatWithStylist` path, persona-aware), and the catalog's `qwen3-vl-30b` as the **vision** model for photo analysis. Two-model pipeline, each with a clear role.
- **Wave 3 (stretch)**: Search for a custom Qwen-VL provider via `0g-compute-cli fine-tuning list-providers`. If found, fine-tune a vision model directly and unify the pipeline.
- **Open question**: Whether 0G's Direct SDK fine-tuning flow supports the multimodal dataset format we'd need for a Qwen-VL run. Resolve in Wave 3.

## Wave-by-Wave Implementation

### Wave 1: Scoping (June 13–26)
- Create `packages/0g-compute/` with SDK integration
- Design African fashion dataset schema
- Architecture diagram + ADR (this document)
- Public X post

### Wave 2: Testnet (June 27 – July 10)
- Dataset collection script (15K+ images)
- Fine-tuning pipeline on 0G testnet
- Demo video: African pattern detection
- README + setup instructions

### Wave 3: Mainnet (July 11–24)
- Deploy fine-tuned model to 0G mainnet
- Register model on 0G Chain
- Update fallback chain in `ai-client`
- Performance metrics (>90% accuracy)

### Wave 4: Traction (July 25 – August 7)
- Live on storefronts (/s/amara for Ankara)
- Curator onboarding flow update
- 10+ users testing African fashion analysis
- User feedback + iteration

### Wave 5: Growth (August 8–21)
- Pitch deck preparation
- Demo Day assets (3-minute video)
- Growth roadmap: expand dataset, regional payments
- Public X post + Demo Day preview

## Alternatives Considered

### Replace all providers with 0G Compute — rejected
- 0G Compute is not ready for general-purpose fashion analysis
- Existing providers (Venice, Gemini, OpenAI) work well for non-African fashion
- Replacement would break existing functionality

### Fine-tune on-device (browser) — rejected
- Browser GPU limitations prevent effective fine-tuning
- Model would be too large for client-side inference
- No verifiability (can't prove which model was used)

### Use 0G Storage for dataset only — rejected
- 0G Storage doesn't provide compute capabilities
- Would still need 0G Compute for fine-tuning
- Adds complexity without value

### Use 0G Chain for model registry only — rejected
- 0G Chain is EVM-compatible, but model registry needs compute integration
- Chain-only solution doesn't solve the inference problem
- Would require separate compute provider anyway

## Consequences

### Positive
- Unique differentiator: Only AI styling agent with African fashion expertise
- Aligned with roadmap: Accelerates "African Differentiation" by 6+ months
- 0G Credits: $50K in credits reduces infrastructure costs
- Demo Day exposure: Token2049 Singapore = massive visibility
- Verifiable: Model registered on 0G Chain for auditability

### Negative / Risks
- Migration effort: New package, provider integration, fallback chain updates
- Dataset quality: African fashion images must be accurately labeled
- 0G Compute maturity: New infrastructure, may have stability issues
- Timeline pressure: 10 weeks is tight for fine-tuning + deployment

### Mitigations
- **Fallback chain**: If 0G Compute fails, fall back to existing providers
- **Dataset validation**: Manual review of 1K+ images before fine-tuning
- **Testnet first**: Wave 2 validates on testnet before mainnet deployment
- **Incremental rollout**: African fashion vertical live first, expand later

## Out of Scope

- Replacing existing AI providers (Venice, Gemini, OpenAI)
- Fine-tuning for non-African fashion (general fashion analysis)
- On-device inference (browser-based model execution)
- Multi-modal fine-tuning (text + vision + audio)

## Open Questions

- **Base model choice**: Qwen VL vs. LLaVA vs. other vision models?
- **Dataset size**: 15K images sufficient, or need 50K+?
- **Fine-tuning method**: Full fine-tuning vs. LoRA vs. QLoRA?
- **Model hosting**: 0G Compute only, or hybrid with local caching?
- **Performance target**: >90% accuracy sufficient, or need >95%?

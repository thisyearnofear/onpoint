# ADR 0006: 0G Compute Integration for African Fashion Fine-Tuning

- **Status:** Proposed — 2026-06-15
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

**Opportunity**: 0G Compute offers decentralized GPU infrastructure for fine-tuning AI models. By fine-tuning a vision model on African fashion data, OnPoint can:
- Achieve >90% accuracy on African pattern classification
- Provide culturally-aware styling recommendations
- Differentiate from competitors (Stitch Fix, ASOS AI, etc.)
- Align with "African Differentiation" roadmap item (Phase Post-MVP)

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
  zeroGProvider,       // Fine-tuned African fashion model (~2s)
  geminiProvider,      // Premium, real-time streaming
  openaiProvider,      // Final fallback
];

// ZeroG provider is conditionally added based on env var
if (process.env.ZERO_G_COMPUTE_ENABLED === "true") {
  FALLBACK_CHAIN.splice(1, 0, zeroGProvider);
}
```

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

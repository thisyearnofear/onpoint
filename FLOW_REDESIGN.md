# Virtual Try-On Flow Redesign

## Current Problems
- Too many disconnected features (10+ modes)
- Unclear user journey
- Duplicate functionality (body analysis vs analyze person vs fashion analysis)
- No clear path to shopping
- Live AR Stylist is separate from main flow

## Proposed Unified Flow

### Single Entry Point: "Upload Photo"

**Step 1: SEES (Vision Analysis)**
- Upload photo
- AI analyzes in ONE call:
  - What you're wearing now
  - Body type & measurements
  - Coloring (skin/hair)
  - Style assessment

**Step 2: JUDGES (Choose Your Stylist)**
- 3 Core Personas (Free):
  - **Miranda Priestly** (Honest) - "The truth, elegantly delivered"
  - **Edina Monsoon** (Roast) - "Darling, let's be brutally honest"
  - **Tan France** (Hype) - "You're gorgeous, let's make you shine"
  
- 3 Unlockable Personas (Premium):
  - Luxury Expert
  - Streetwear Guru
  - Sustainable Stylist

**Step 3: SHOPS (Agent Wallet)**
- "Let Agent Shop" button
- Shows curated items based on analysis
- Agent wallet checkout with spend limits

### Optional: Live AR Try-On
- Available as upgrade from Step 1
- "Try Live AR" button after analysis
- Uses Gemini Live for real-time feedback

## What to DELETE

### Consolidate These:
- ❌ Body Analysis (separate)
- ❌ Analyze Person (separate)  
- ❌ Fashion Analysis (Replicate)
- ✅ ONE unified vision analysis

### Remove These:
- ❌ Body Scan (no photo) - confusing, no value
- ❌ Look version history - premature feature
- ❌ Compare versions - premature feature
- ❌ Generate outfit image - doesn't lead to shopping

### Keep & Enhance:
- ✅ Photo upload → Vision analysis
- ✅ 3 core personas (free) + 3 unlockable (premium)
- ✅ Shop recommendations → Agent wallet
- ✅ Live AR Stylist (as premium upgrade)

## Persona Mapping

**Free Tier:**
1. Miranda Priestly (Honest/Real) - Professional, direct, constructive
2. Edina Monsoon (Roast) - Hilarious, brutal, memorable
3. Tan France (Hype) - Supportive, confidence-building, positive

**Premium Unlock:**
4. Luxury Expert (High-end fashion focus)
5. Streetwear Guru (Urban, trendy, youth culture)
6. Sustainable Stylist (Eco-conscious, ethical fashion)

## New Component Structure

```
VirtualTryOn/
├── PhotoUpload.tsx          (entry point)
├── VisionAnalysis.tsx       (consolidated analysis)
├── PersonaSelector.tsx      (3 free + 3 premium)
├── CritiqueResult.tsx       (persona feedback)
├── ShopRecommendations.tsx  (bridge to shop)
└── LiveARUpgrade.tsx        (optional premium)
```

## User Journey

1. **Land on page** → See "Upload Photo" CTA
2. **Upload** → Get instant vision analysis (sees)
3. **Choose persona** → Pick Miranda/Edina/Tan (judges)
4. **Get critique** → Persona-specific feedback
5. **See recommendations** → "Let Agent Shop" button (shops)
6. **Optional:** "Try Live AR" or unlock premium personas

## Benefits
- Clear linear flow
- Personas add personality & relatability
- Each step has purpose
- Leads to monetization (shopping + premium personas)
- Less cognitive load
- Faster, more focused

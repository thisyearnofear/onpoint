# Week 1 Quick-Start Checklist

**Goal**: Ship curator-focused homepage redesign by end of Week 1 (2026-07-07)

**Success**: 3 ready curators can onboard and understand the value proposition immediately.

---

## Monday: Setup & Planning

### Morning: Branch & Architecture
- [ ] Create feature branch: `git checkout -b feat/curator-homepage-redesign`
- [ ] Review `docs/STRATEGY.md` and `docs/PHASE_1_IMPLEMENTATION.md`
- [ ] Share plan with team, get alignment on scope
- [ ] Set up daily 15-min standup (blockers only)

### Afternoon: Component Inventory
- [ ] List existing components to move from `/` to `/shop`:
  - `PersonaCarousel` (apps/web/app/page.tsx:75-120)
  - `StylePreferences` (body type, occasion, vibe selectors)
  - `InlineShop` (product grid)
- [ ] List components to remove entirely:
  - Design studio promo
  - Agent wallet teaser
  - Complex onboarding flow
- [ ] Sketch new homepage structure (Figma or paper)

---

## Tuesday: Create New Components

### Morning: Curator Hero Section
**File**: `apps/web/components/Curator/CuratorHero.tsx` (NEW)

```tsx
"use client";

import { Button } from "@repo/ui/button";
import { ArrowRight, Store, Smartphone, DollarSign } from "lucide-react";
import Link from "next/link";

export function CuratorHero() {
  return (
    <section className="relative py-20 px-4 bg-gradient-to-br from-primary/5 to-accent/5">
      <div className="container max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: Value Prop */}
          <div>
            <h1 className="text-5xl font-bold mb-4">
              Your WhatsApp.
              <br />
              Your Storefront.
              <br />
              <span className="text-primary">AI-Powered.</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8">
              Turn your fashion business into a branded storefront in 30 seconds.
              Get paid via M-Pesa. Let AI help your customers try before they buy.
            </p>
            
            <div className="flex gap-4">
              <Button asChild size="lg">
                <Link href="/curator/onboard">
                  Start Selling Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              
              <Button asChild variant="outline" size="lg">
                <Link href="#how-it-works">
                  See How It Works
                </Link>
              </Button>
            </div>
            
            {/* Trust signals */}
            <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                <span>3 curators earning</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                <span>M-Pesa integrated</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span>Free to start</span>
              </div>
            </div>
          </div>
          
          {/* Right: Demo video or screenshot */}
          <div className="relative aspect-video rounded-lg overflow-hidden shadow-2xl">
            {/* TODO: Add demo video or animated screenshot */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white">
              <p>Demo video placeholder</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

**Checklist**:
- [ ] Create file
- [ ] Add trust signals (update numbers as curators join)
- [ ] Test responsive layout (mobile + desktop)
- [ ] Verify all links work

---

### Afternoon: How It Works Section
**File**: `apps/web/components/Curator/HowItWorks.tsx` (NEW)

```tsx
"use client";

import { Smartphone, Upload, Share2 } from "lucide-react";

const steps = [
  {
    icon: Smartphone,
    title: "1. Connect WhatsApp",
    description: "Sign up with your business WhatsApp number. Takes 30 seconds.",
  },
  {
    icon: Upload,
    title: "2. Upload Products",
    description: "Take photos with your phone or bulk import. Add sizes and prices.",
  },
  {
    icon: Share2,
    title: "3. Share & Earn",
    description: "Send your storefront link. Get paid via M-Pesa. We handle the rest.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 bg-background">
      <div className="container max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">
          Start Selling in 3 Simple Steps
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, idx) => (
            <div key={idx} className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <step.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Checklist**:
- [ ] Create file
- [ ] Test responsive grid (stacks on mobile)
- [ ] Update copy based on actual onboarding flow

---

## Wednesday: Testimonials & Pricing

### Morning: Curator Testimonials
**File**: `apps/web/components/Curator/CuratorTestimonials.tsx` (NEW)

```tsx
"use client";

import Image from "next/image";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Wanja",
    business: "Premier League Jerseys",
    avatar: "/avatars/wanja.jpg", // TODO: Add real photo
    quote: "Sold 12 jerseys in my first week. The AI try-on feature helps customers see themselves in the kit before buying.",
    earnings: "KES 45,000 last month",
  },
  // TODO: Add 2 more curator testimonials
];

export function CuratorTestimonials() {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">
          Join Curators Already Earning
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, idx) => (
            <div key={idx} className="bg-background rounded-lg p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <Image
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  width={48}
                  height={48}
                  className="rounded-full"
                />
                <div>
                  <h4 className="font-semibold">{testimonial.name}</h4>
                  <p className="text-sm text-muted-foreground">{testimonial.business}</p>
                </div>
              </div>
              
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              
              <p className="text-sm mb-4">&ldquo;{testimonial.quote}&rdquo;</p>
              
              <p className="text-sm font-semibold text-primary">
                {testimonial.earnings}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Checklist**:
- [ ] Create file
- [ ] Get real curator testimonials (interview Wanja + 2 others)
- [ ] Add real photos or use initials as fallback
- [ ] Update earnings numbers (verify with actual data)

---

### Afternoon: Simple Pricing Section
**File**: `apps/web/components/Curator/PricingSimple.tsx` (NEW)

```tsx
"use client";

import { Check } from "lucide-react";
import { Button } from "@repo/ui/button";
import Link from "next/link";

export function PricingSimple() {
  return (
    <section className="py-20 px-4 bg-background">
      <div className="container max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">
          Simple, Transparent Pricing
        </h2>
        <p className="text-xl text-muted-foreground mb-12">
          Free to start. Only pay when you earn.
        </p>
        
        <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl p-8 max-w-md mx-auto">
          <div className="mb-6">
            <p className="text-5xl font-bold mb-2">5%</p>
            <p className="text-muted-foreground">per successful sale</p>
          </div>
          
          <ul className="space-y-3 mb-8 text-left">
            <li className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span>Branded storefront at your own URL</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span>M-Pesa payment integration</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span>AI virtual try-on for customers</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span>WhatsApp receipt automation</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span>Order & customer management</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span>Analytics & insights</span>
            </li>
          </ul>
          
          <Button asChild size="lg" className="w-full">
            <Link href="/curator/onboard">
              Start Selling Free
            </Link>
          </Button>
          
          <p className="text-xs text-muted-foreground mt-4">
            No monthly fees. No hidden charges. Cancel anytime.
          </p>
        </div>
      </div>
    </section>
  );
}
```

**Checklist**:
- [ ] Create file
- [ ] Verify 5% fee is accurate (check with finance/product)
- [ ] Confirm all features listed are actually built
- [ ] Test CTA link works

---

## Thursday: Homepage Rewrite & Shop Page

### Morning: Rewrite Homepage
**File**: `apps/web/app/page.tsx` (MAJOR EDIT)

```tsx
"use client";

import { CuratorHero } from "../components/Curator/CuratorHero";
import { HowItWorks } from "../components/Curator/HowItWorks";
import { CuratorTestimonials } from "../components/Curator/CuratorTestimonials";
import { PricingSimple } from "../components/Curator/PricingSimple";
import { FAQ } from "../components/Curator/FAQ";
import { CTASection } from "../components/Curator/CTASection";

export default function Home() {
  return (
    <main className="min-h-screen">
      <CuratorHero />
      <HowItWorks />
      <CuratorTestimonials />
      <PricingSimple />
      <FAQ />
      <CTASection />
    </main>
  );
}
```

**Checklist**:
- [ ] Back up current `page.tsx` (save as `page.tsx.backup`)
- [ ] Rewrite with new curator-focused components
- [ ] Remove all consumer-focused content
- [ ] Test page loads without errors
- [ ] Verify all sections appear in correct order

---

### Afternoon: Create Shop Page (Consumer Experience)
**File**: `apps/web/app/shop/page.tsx` (NEW)

```tsx
"use client";

import { PersonaCarousel } from "../../components/AIStylist/PersonaCard";
import { InlineShop } from "../../components/Shop/InlineShop";

export default function ShopPage() {
  return (
    <main className="min-h-screen">
      <section className="py-12 px-4 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="container max-w-6xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">
            Find Your Style with AI
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Get instant feedback from AI stylists, try on looks virtually, and shop the recommendations.
          </p>
        </div>
      </section>
      
      <PersonaCarousel />  {/* Moved from homepage */}
      <InlineShop />       {/* Existing component */}
    </main>
  );
}
```

**Checklist**:
- [ ] Create file and directory
- [ ] Move PersonaCarousel component (verify imports work)
- [ ] Test shop page loads correctly
- [ ] Verify persona selection still works
- [ ] Update navigation to link to `/shop`

---

## Friday: Navigation & Polish

### Morning: Update Navigation
**File**: `apps/web/app/layout.tsx` (EDIT)

```tsx
// Update desktop header links (around line 50-60)
<nav className="flex items-center gap-6">
  <Link 
    href="/curator" 
    className="text-sm font-medium text-primary hover:underline"
  >
    Start Selling
  </Link>
  <Link href="/shop" className="text-sm font-medium hover:underline">
    Shop Styles
  </Link>
  <Link href="/guides" className="text-sm font-medium hover:underline">
    Guides
  </Link>
  <Link href="/about" className="text-sm font-medium hover:underline">
    About
  </Link>
</nav>

// Add footer link for AI Agent (around line 200)
<Link href="/lab" className="text-sm text-muted-foreground hover:underline">
  AI Agent (Power Users)
</Link>
```

**File**: `apps/web/components/mobile-navigation.tsx` (EDIT)

```tsx
// Update navigation items (around line 30)
const navItems = [
  { href: "/curator", icon: Store, label: "Sell" },
  { href: "/shop", icon: ShoppingBag, label: "Shop" },
  { href: "/lab", icon: Bot, label: "Agent" },
  { href: "/guides", icon: Book, label: "Guides" },
];
```

**Checklist**:
- [ ] Update desktop header navigation
- [ ] Update mobile navigation
- [ ] Add footer link to `/lab`
- [ ] Test all navigation links work
- [ ] Verify active state highlights correctly

---

### Afternoon: Final Polish & Testing

**Create remaining components** (if time allows):

**File**: `apps/web/components/Curator/FAQ.tsx` (NEW)
```tsx
// Accordion with common questions:
// - "How do I get paid?"
// - "What if my customer wants a refund?"
// - "Can I use my existing WhatsApp number?"
// - "How does the AI try-on work?"
// - "What fees do you charge?"
```

**File**: `apps/web/components/Curator/CTASection.tsx` (NEW)
```tsx
// Final CTA before footer:
// - "Ready to start selling?"
// - Big button: "Create Your Storefront"
// - Trust signals repeated
```

**Checklist**:
- [ ] Create FAQ component
- [ ] Create CTA section
- [ ] Add to homepage
- [ ] Test entire page flow
- [ ] Mobile responsive check (iPhone, Android)
- [ ] Lighthouse audit (aim for >90 performance)

---

## Testing Checklist (End of Week)

### Functional Tests
- [ ] Homepage loads in < 2s
- [ ] All navigation links work
- [ ] "Start Selling" CTA → `/curator/onboard`
- [ ] "/shop" has old consumer experience
- [ ] Mobile responsive (test on real devices)
- [ ] No console errors
- [ ] Images load correctly
- [ ] Videos/animations work

### Content Review
- [ ] Copy is clear and compelling
- [ ] No typos or grammatical errors
- [ ] Trust signals are accurate (numbers verified)
- [ ] CTAs are prominent and clear
- [ ] Value proposition is immediately clear

### User Testing (Critical!)
- [ ] Show to 3 ready curators
- [ ] Ask: "What does this product do?" (should say: helps me sell online)
- [ ] Ask: "Would you click 'Start Selling'?" (should say yes)
- [ ] Note any confusion or hesitation
- [ ] Make adjustments based on feedback

---

## Deployment (Friday EOD)

### Pre-deployment
- [ ] Run type check: `pnpm turbo run check-types`
- [ ] Run lint: `pnpm turbo run lint`
- [ ] Build locally: `pnpm turbo run build --filter=apps/web`
- [ ] Test production build: `pnpm --filter=apps/web start`

### Deploy to Staging
```bash
git add .
git commit -m "feat: curator-focused homepage redesign

- New CuratorHero with clear value prop
- HowItWorks 3-step visual
- Curator testimonials with earnings proof
- Simple pricing (5% per sale)
- FAQ section
- CTA throughout page
- Moved consumer experience to /shop
- Updated navigation (curator-first)

Refs: docs/STRATEGY.md, docs/PHASE_1_IMPLEMENTATION.md"

git push origin feat/curator-homepage-redesign
```

- [ ] Create PR on GitHub
- [ ] Request review from team
- [ ] Deploy to staging (Netlify preview)
- [ ] Test on staging URL

### Deploy to Production
- [ ] Get approval from product lead
- [ ] Merge PR to main
- [ ] Auto-deploy to production (Netlify)
- [ ] Smoke test production site
- [ ] Monitor Sentry for errors (first 1 hour)

---

## Success Criteria (Week 1)

By Friday EOD, we should have:
- ✅ New curator-focused homepage live
- ✅ Consumer experience moved to `/shop`
- ✅ Navigation updated
- ✅ All links working
- ✅ Mobile responsive
- ✅ 3 curators reviewed and approved
- ✅ Zero production errors

**If successful**: Move to Week 2 (Mobile Curator Dashboard)

**If blocked**: Document blockers, adjust Week 2 scope accordingly

---

## Emergency Contacts

If you get stuck:
- **Design questions**: Review `docs/STRATEGY.md` for positioning
- **Technical questions**: Check existing components in `apps/web/components/`
- **Scope questions**: Can this wait until Week 2? (probably yes)

**Remember**: Perfect is the enemy of done. Ship something working by Friday, polish in Week 2.

---

**Document Owner**: Engineering Lead  
**Status**: Ready to start Monday 2026-07-01  
**Next Review**: Friday 2026-07-05 (mid-week check-in)

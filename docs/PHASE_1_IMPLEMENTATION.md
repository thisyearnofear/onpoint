# Phase 1 Implementation Guide: Curator Domination

**Goal**: Transform OnPoint into the obvious choice for WhatsApp-first fashion sellers in Africa.

**Timeline**: 4 weeks (2026-07-01 → 2026-07-31)

**Success Metrics**:
- 10 active curators (currently 3 ready)
- 40% activation rate (onboard → first sale within 7 days)
- 60% week-1 retention
- NPS > 50

---

## Week 1: Homepage Redesign (Curator-First)

### Objective
Replace consumer-focused landing page with curator value proposition. Make it crystal clear this is a tool for sellers, not shoppers.

### Files to Modify

#### 1. `apps/web/app/page.tsx` — Complete Rewrite

**Current State**: Persona selector, body type picker, occasion selector, vibe cards = consumer focus

**New State**: Curator-first hero with clear value prop

```tsx
// New structure:
export default function Home() {
  return (
    <>
      <CuratorHero />           // NEW: "Your WhatsApp → Your Storefront"
      <HowItWorks />            // NEW: 3-step visual (Connect → Upload → Sell)
      <CuratorTestimonials />   // NEW: Success stories with earnings
      <PricingSimple />         // NEW: "Free to start, 5% per sale"
      <FAQ />                   // NEW: Common questions from sellers
      <CTASection />            // NEW: "Start Selling in 30 Seconds"
      
      {/* Move to /shop */}
      {/* <PersonaCarousel /> */}
      {/* <StylePreferences /> */}
    </>
  );
}
```

**Key Changes**:
- Remove: PersonaCarousel, body type selector, occasion picker, vibe cards
- Add: Curator testimonials component with real earnings data
- Add: WhatsApp integration explainer (how it works)
- Add: Trust signals (M-Pesa verified, 3 curators already earning)

#### 2. `apps/web/app/shop/page.tsx` — NEW FILE

Move consumer shopping experience here.

```tsx
"use client";

// This becomes the new home for persona selection + shopping
export default function ShopPage() {
  return (
    <>
      <ShopHero />              // "Find your style with AI"
      <PersonaCarousel />        // Moved from home
      <StylePreferences />       // Moved from home
      <InlineShop />            // Existing component
    </>
  );
}
```

#### 3. Navigation Updates

**`apps/web/app/layout.tsx`** (Desktop header):
```tsx
// Change primary nav:
<Link href="/curator">Start Selling</Link>  // Prominent, primary CTA
<Link href="/shop">Shop Styles</Link>      // Secondary
<Link href="/lab">AI Agent</Link>          // Tertiary (footer too)
<Link href="/guides">Guides</Link>
<Link href="/about">About</Link>
```

**`apps/web/components/mobile-navigation.tsx`** (Mobile nav):
```tsx
// Update nav items priority:
{ href: "/curator", icon: Store, label: "Sell" },      // First
{ href: "/shop", icon: ShoppingBag, label: "Shop" },   // Second
{ href: "/lab", icon: Bot, label: "Agent" },           // Third
{ href: "/guides", icon: Book, label: "Guides" },
```

#### 4. New Components Needed

**`apps/web/components/Curator/CuratorHero.tsx`** — NEW FILE
```tsx
// Hero section with:
// - Headline: "Your WhatsApp. Your Storefront. AI-Powered."
// - Subhead: "Turn your fashion business into a branded storefront in 30 seconds"
// - CTA: "Start Selling Free" → /curator/onboard
// - Demo video: WhatsApp chat → storefront transformation
// - Trust signals: "3 curators already earning", "M-Pesa integrated"
```

**`apps/web/components/Curator/HowItWorks.tsx`** — NEW FILE
```tsx
// 3-step visual:
// 1. Connect WhatsApp → Your number
// 2. Upload Products → Phone camera or bulk import
// 3. Share & Earn → Send link, get paid via M-Pesa
```

**`apps/web/components/Curator/CuratorTestimonials.tsx`** — NEW FILE
```tsx
// Real curator success stories:
// "Wanja sold 12 jerseys in her first week"
// "$450 earned last month"
// "Customers love the AI try-on feature"
```

---

## Week 2: Mobile-First Curator Dashboard

### Objective
Make `/admin/curators/[slug]` usable on mobile. Curators manage their business from their phones.

### Files to Modify

#### 1. `apps/web/app/admin/curators/[slug]/page.tsx` — Mobile Optimization

**Current Issues**:
- Desktop-first layout (sidebars, multi-column tables)
- Small touch targets
- No swipe gestures
- Complex forms not optimized for phone keyboards

**Changes Needed**:
```tsx
// Add mobile-first responsive design
"use client";

export default function CuratorAdminPage({ params }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  return (
    <div className="min-h-screen bg-background">
      {isMobile ? (
        <MobileCuratorDashboard slug={params.slug} />
      ) : (
        <DesktopCuratorDashboard slug={params.slug} />
      )}
    </div>
  );
}
```

#### 2. New Mobile Components

**`apps/web/components/Curator/MobileCuratorDashboard.tsx`** — NEW FILE
```tsx
// Mobile-optimized layout:
// - Tab navigation at bottom (Orders, Products, Customers, Analytics)
// - Large touch targets (min 44x44px)
// - Swipe actions on list items (swipe left = "Mark Shipped")
// - Pull-to-refresh
// - Bottom sheet modals instead of full-page forms
```

**`apps/web/components/Curator/MobileOrderCard.tsx`** — NEW FILE
```tsx
// Mobile-friendly order card:
// - Swipe left: "Mark Shipped" action
// - Swipe right: "Send Receipt" action
// - Tap: Expand to see details
// - Clear status indicator (Pending, Paid, Shipped, Delivered)
```

**`apps/web/components/Curator/QuickActions.tsx`** — NEW FILE
```tsx
// Floating action button with quick actions:
// - Add Product (opens camera)
// - Broadcast to Customers
// - Send Receipt
// - Mark Order Shipped
```

#### 3. Photo Upload from Phone Camera

**`apps/web/components/Curator/ProductPhotoUpload.tsx`** — NEW FILE
```tsx
"use client";

export function ProductPhotoUpload({ onUpload }) {
  return (
    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
      <input
        type="file"
        accept="image/*"
        capture="environment"  // Opens camera on mobile
        onChange={handleCapture}
        className="hidden"
      />
      <Camera className="w-12 h-12 text-muted-foreground" />
      <span>Take Photo or Upload</span>
    </label>
  );
}
```

---

## Week 3: Order Management & CRM

### Objective
Give curators visibility into orders and customers. Surface repeat buyers, track order status, manage fulfillment.

### Files to Modify

#### 1. `apps/web/app/admin/curators/[slug]/orders/page.tsx` — NEW FILE

```tsx
"use client";

export default function CuratorOrdersPage({ params }) {
  const { orders, isLoading } = useOrders(params.slug);
  
  return (
    <div className="container py-6">
      <h1>Orders</h1>
      
      {/* Filter tabs */}
      <OrderTabs />  {/* All, Pending, Paid, Shipped, Delivered */}
      
      {/* Order list */}
      <OrderList orders={orders} />
      
      {/* Bulk actions */}
      <BulkActions />  {/* Mark multiple as shipped */}
    </div>
  );
}
```

#### 2. New API Routes

**`apps/web/app/api/curator/orders/route.ts`** — NEW FILE
```typescript
// GET /api/curator/orders?slug=wanja&status=pending
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const status = searchParams.get('status');
  
  // Query orders from Neon Postgres
  const orders = await db.query.orders.findMany({
    where: and(
      eq(orders.curatorSlug, slug),
      status ? eq(orders.status, status) : undefined
    ),
    orderBy: desc(orders.createdAt),
  });
  
  return Response.json({ orders });
}

// PATCH /api/curator/orders/:id
export async function PATCH(request: Request) {
  const { id, status, trackingNumber } = await request.json();
  
  await db.update(orders)
    .set({ status, trackingNumber, updatedAt: new Date() })
    .where(eq(orders.id, id));
  
  // Send WhatsApp notification to customer
  if (status === 'shipped' && trackingNumber) {
    await sendShippingNotification(order.customerPhone, trackingNumber);
  }
  
  return Response.json({ success: true });
}
```

#### 3. Customer CRM Component

**`apps/web/components/Curator/CustomerList.tsx`** — NEW FILE
```tsx
// Display customer insights:
// - Total orders per customer
// - Last order date
// - Total spent
// - Contact info (phone, WhatsApp)
// - Quick action: "Send Message" (opens WhatsApp)
```

**`apps/web/app/api/curator/customers/route.ts`** — NEW FILE
```typescript
// GET /api/curator/customers?slug=wanja
// Returns aggregated customer data from orders table
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  
  // Aggregate orders by customer phone
  const customers = await db.select({
    phone: orders.customerPhone,
    name: orders.customerName,
    totalOrders: count(orders.id),
    totalSpent: sum(orders.amount),
    lastOrderDate: max(orders.createdAt),
  })
  .from(orders)
  .where(eq(orders.curatorSlug, slug))
  .groupBy(orders.customerPhone);
  
  return Response.json({ customers });
}
```

---

## Week 4: Self-Serve Product Upload & Automation

### Objective
Let curators add products themselves without admin intervention. Add one-tap marketing automation.

### Files to Modify

#### 1. `apps/web/app/curator/products/new/page.tsx` — NEW FILE

Self-serve product creation form:

```tsx
"use client";

export default function NewProductPage() {
  return (
    <form onSubmit={handleSubmit}>
      <ProductPhotoUpload />  {/* From Week 2 */}
      
      <Input name="title" placeholder="Product Name" />
      <Textarea name="description" placeholder="Description" />
      <Input name="price" type="number" placeholder="Price (KES)" />
      <Select name="category">
        <option>Jerseys</option>
        <option>Sneakers</option>
        <option>Streetwear</option>
      </Select>
      
      {/* Size/variant management */}
      <SizeVariantPicker />
      
      <Button type="submit">Add to Store</Button>
    </form>
  );
}
```

#### 2. Image Upload to Cloudflare R2

**`apps/web/app/api/curator/products/upload/route.ts`** — NEW FILE
```typescript
import { uploadToR2 } from '@repo/storage';

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('image') as File;
  const curatorSlug = formData.get('slug') as string;
  
  // Upload to R2
  const imageUrl = await uploadToR2(file, `curators/${curatorSlug}/products`);
  
  return Response.json({ imageUrl });
}
```

#### 3. Marketing Automation: Broadcast Feature

**`apps/web/components/Curator/BroadcastModal.tsx`** — NEW FILE
```tsx
// Modal with:
// - Template selector (New Stock, Sale, Restock)
// - Customer filter (All, Repeat Buyers, Inactive 30+ days)
// - Preview message
// - Send button → triggers WhatsApp broadcasts
```

**`apps/web/app/api/curator/broadcast/route.ts`** — NEW FILE
```typescript
// POST /api/curator/broadcast
export async function POST(request: Request) {
  const { slug, template, customerFilter, message } = await request.json();
  
  // Get matching customers
  const customers = await getCustomersByFilter(slug, customerFilter);
  
  // Queue WhatsApp messages (use existing sendWhatsAppMessage)
  for (const customer of customers) {
    await sendWhatsAppMessage(customer.phone, message);
    
    // Rate limit: 1 message per second to avoid Meta blocks
    await sleep(1000);
  }
  
  return Response.json({ sent: customers.length });
}
```

---

## Testing Strategy

### Manual Testing Checklist (Before Launch)

**Week 1 (Homepage)**:
- [ ] Homepage loads in < 2s on 3G connection
- [ ] CTA "Start Selling" → `/curator/onboard` works
- [ ] Mobile responsive (test on actual iPhone + Android)
- [ ] `/shop` page has old consumer experience intact

**Week 2 (Mobile Dashboard)**:
- [ ] Dashboard loads on phone (Safari iOS, Chrome Android)
- [ ] Touch targets are ≥ 44x44px
- [ ] Swipe gestures work on OrderCard
- [ ] Photo upload opens camera on mobile
- [ ] Forms are easy to fill on phone keyboard

**Week 3 (Orders & CRM)**:
- [ ] Orders list loads with real data
- [ ] "Mark Shipped" updates status in database
- [ ] WhatsApp notification sent when order ships
- [ ] Customer list shows accurate totals
- [ ] "Send Message" opens WhatsApp with pre-filled text

**Week 4 (Products & Automation)**:
- [ ] Curator can upload product from phone
- [ ] Image uploads to R2 successfully
- [ ] New product appears on storefront immediately
- [ ] Broadcast sends to all customers (test with 2-3 numbers first)
- [ ] Rate limiting works (no Meta blocks)

### User Testing (Critical)

**Recruit 3 curators for testing**:
1. **Wanja** (existing, football jerseys)
2. **New curator #1** (streetwear)
3. **New curator #2** (women's fashion)

**Test Protocol**:
1. Watch them onboard (screen record, take notes)
2. Ask them to add 3 products from their phone
3. Ask them to check orders
4. Ask them to send a broadcast message
5. Interview: What was confusing? What would you change?

**Success Criteria**:
- All 3 complete onboarding without help
- All 3 successfully add products
- 2/3 say they would use this daily
- NPS ≥ 50 (would recommend to another seller)

---

## Deployment Plan

### Week 1 Deployment
```bash
# Deploy homepage redesign
cd apps/web
git checkout -b feat/curator-homepage
# ... make changes ...
git commit -m "feat: curator-first homepage redesign"
git push origin feat/curator-homepage

# PR → main → auto-deploy to Netlify
```

### Week 2 Deployment
```bash
# Deploy mobile dashboard
git checkout -b feat/mobile-curator-dashboard
# ... make changes ...
git commit -m "feat: mobile-optimized curator dashboard"
```

### Week 3 Deployment
```bash
# Deploy order management + CRM
git checkout -b feat/curator-orders-crm
# ... make changes ...
git commit -m "feat: order management and customer CRM"
```

### Week 4 Deployment
```bash
# Deploy self-serve products + automation
git checkout -b feat/curator-self-serve
# ... make changes ...
git commit -m "feat: self-serve product upload and broadcast automation"
```

---

## Monitoring & Metrics

### Dashboard to Build (PostHog or Custom)

**Curator Activation Funnel**:
1. Land on homepage
2. Click "Start Selling"
3. Complete onboarding form
4. Add first product
5. Share storefront link
6. First sale

**Track Drop-Off at Each Step**:
- Homepage → Onboard: 60% expected
- Onboard → First Product: 70% expected
- First Product → Share: 80% expected
- Share → First Sale: 40% target

**Key Metrics (Daily Review)**:
- New curator signups
- Curators with ≥1 product added
- Curators with ≥1 sale
- Days to first sale (target: < 7 days)
- Week-1 retention (curator logs in 2+ times in first week)

---

## Success Criteria (Phase 1 Exit)

We do NOT move to Phase 2 until we hit:

- ✅ **10 active curators** (has ≥1 sale in last 30 days)
- ✅ **40% activation rate** (onboard → first sale within 7 days)
- ✅ **60% week-1 retention** (logs in 2+ times in first week)
- ✅ **NPS > 50** (curator survey: "Would you recommend OnPoint?")

**"Active" = 3 consecutive weeks with all 4 metrics above target.**

---

## Next Steps After Phase 1

Once we hit exit criteria, we move to **Phase 2: Consumer Reliability** (see docs/STRATEGY.md).

Focus shifts to making the AR styling experience fast and reliable for the consumers shopping on curator storefronts.

---

**Document Owner**: Engineering Lead  
**Last Updated**: 2026-06-30  
**Status**: Ready to implement (Week 1 starts 2026-07-01)

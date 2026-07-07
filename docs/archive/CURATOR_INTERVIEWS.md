# Curator Interview Protocol

**Purpose**: Diagnose specific blockers in OnPoint's curator activation funnel before building anything new.

**Why this matters**: We have `/curator`, `/curator/onboard`, `/s/[slug]`, and `/admin/curators/[slug]` all built. The 3 curators ready to onboard are confused — but we don't know WHY. Build nothing until we know.

**Time per interview**: 30 minutes

**Required**: Screen recording (with permission), notes

---

## Interview Structure

### Part 1: Cold Landing (5 min)

**Setup**: Give them ONLY the URL `https://beonpoint.netlify.app` — no context.

**Observe silently** (don't help):
- Where do they click first?
- Do they understand this is for sellers or shoppers?
- How long until they find `/curator`?

**Ask**:
1. "What do you think this product does?"
2. "Who is this for?"
3. "If you wanted to sell on this platform, where would you go?"

**Hypothesis to test**: Does root `/` confuse curators?

---

### Part 2: Curator Landing Page (5 min)

**Setup**: Navigate them to `/curator`.

**Observe**:
- Do they read the archetypes section?
- Which archetype matches them?
- Does the Wanja testimonial resonate?

**Ask**:
1. "Does this look like a fit for your business?"
2. "What's missing that would convince you to sign up?"
3. "What questions do you still have?"

**Hypothesis to test**: Is `/curator` messaging clear and compelling?

---

### Part 3: Onboarding Flow (10 min)

**Setup**: Have them click "Create your storefront" / "Apply now" → `/curator/onboard`.

**Observe**:
- Where do they hesitate?
- Which fields confuse them?
- Do they understand the vertical selection?
- Do they complete it?

**Ask** (during, not after):
1. "What were you expecting when you clicked this?"
2. "What does this field mean to you?"
3. "Is there anything you'd want to add or remove from this form?"

**Hypothesis to test**: Does onboarding form cause drop-off?

---

### Part 4: Storefront Preview (5 min)

**Setup**: Show them `/s/wanja` (the example storefront).

**Observe**:
- Do they understand what their own storefront would look like?
- Do they see how customers would use it?

**Ask**:
1. "Is this how you'd want your storefront to look?"
2. "What's missing? What's extra?"
3. "If a customer landed here, what would they do?"

**Hypothesis to test**: Is the storefront experience clear?

---

### Part 5: Admin Dashboard (5 min)

**Setup**: If they've completed onboarding, show them `/admin/curators/[their-slug]`. If not, show them Wanja's admin (with permission).

**Critical**: Do this on their phone, not a laptop.

**Observe**:
- Can they navigate on mobile?
- Can they find where to add a product?
- Can they find orders?

**Ask**:
1. "If you wanted to add a new product right now, how would you do it?"
2. "How would you check who has paid you?"
3. "What's the most important thing you need to do daily?"

**Hypothesis to test**: Is admin dashboard mobile-usable?

---

## Output Template

After each interview, document in `docs/curator-feedback/[curator-name]-[date].md`:

```markdown
# Curator Interview: [Name]

**Date**: 2026-07-XX
**Vertical**: [Sportswear / Streetwear / Ankara / etc.]
**Current channel**: [WhatsApp / Instagram / Both]
**Monthly revenue range**: [KES X - Y]

## Cold Landing
- First click: [...]
- Understanding: [Clear / Confused]
- Quote: "[...]"

## Curator Page
- Fit feeling: [Strong / Moderate / Weak]
- Missing info: [...]
- Quote: "[...]"

## Onboarding
- Completed: [Y/N]
- Drop-off point: [field name]
- Friction points: [...]
- Quote: "[...]"

## Storefront Preview
- Match expectations: [Y/N]
- Missing features: [...]
- Quote: "[...]"

## Admin Dashboard (Mobile)
- Mobile usable: [Y/N]
- Time to add product: [X seconds]
- Confusion points: [...]
- Quote: "[...]"

## Top 3 Blockers
1. [...]
2. [...]
3. [...]

## Top 3 Requests
1. [...]
2. [...]
3. [...]

## Activation Likelihood
- Will they actually use it? [Yes / Maybe / No]
- Why: [...]
```

---

## Synthesis After 3 Interviews

Once all 3 curators are interviewed, create `docs/curator-feedback/synthesis-2026-07.md` with:

1. **Common blockers** (mentioned by 2+ curators)
2. **Specific fixes** (smallest possible change per blocker)
3. **Priority ranking** (by impact on activation)
4. **PRs to ship** (one per fix, with measured impact target)

**Decision rule**: Only build/change what 2+ curators flag as a blocker. Single-curator requests go to backlog.

---

## What NOT to Do

- ❌ Don't lead the curator ("Wouldn't it be great if...")
- ❌ Don't apologize for confusion (just observe and note)
- ❌ Don't fix things during the interview (observe, then decide)
- ❌ Don't promise features (we only build based on patterns)
- ❌ Don't show them what we've planned to build (biases their feedback)

---

## Why This Approach

We have ~20 existing curator-facing components and routes. We don't need MORE — we need to know which existing ones underperform. Without curator interviews, we'd be building on assumption (which is what caused the previous bloat).

**Discipline beats ambition.** Listen first, build second.

---

**Document Owner**: Product Lead  
**Next Action**: Schedule 3 interviews this week (2026-07-01 to 2026-07-07)

# META_VR_START_COMPETITION.md — Meta VR Start Developer Competition 2026

> Project: **OnPoint** — Agentic Fashion Commerce
> Competition: Meta VR Start Developer Competition 2026
> Platform: Meta Quest (standalone VR) / WebXR
> Prize Pool: $10,000+ in cash + Meta SDK credits + showcase exposure
> Submission Deadline: Typically mid‑November 2026 (check Devpost for exact date)
> Build Window: 4‑6 weeks from registration
> Team Size: Individual or up to 4 people
> Existing projects: Permitted — must show significant new work during the competition window

## 1. Why OnPoint fits the Meta VR Start Competition
OnPoint already turns live fashion inventory into **fit‑aware, machine‑readable, payable offers** for both humans and agents. The VR angle is natural: a **virtual showroom** where avatars browse, try‑on, and purchase items using hand‑tracking or controllers. The competition judges look for innovation in user interaction, performance, and a clear narrative of what you built.

## 2. Competition‑ready adaptation
### Core VR loop (2‑min demo)
1. **Avatar enters virtual showroom** – a stylized gallery of fashion items.
2. **Browse with hand gestures** – swipe left/right, pinch to select an item.
3. **AI try‑on** – the agent‑driven try‑on effect renders the item on the avatar.
4. **Checkout gesture** – a pinch‑and‑hold completes the purchase; a receipt pop‑up appears.
5. **Result screen** – shows item, price (cUSD), referral commission (2.5%), and a shareable polaroid.

### New work required during the competition window
- **VR‑optimized gallery** – port the wardrobe studio to Quest‑native shaders; reduce polygon count of clothing items.<br>- **Hand‑tracking gestures** – map pinch/swipe gestures to item selection and checkout.<br>- **Avatar customization** – a simple avatar picker (3 body types, 3 skin tones) that appears at the start.
- **Try‑on shader** – simple material swap that swaps the runway‑model texture onto the avatar mesh.
- **Receipt pop‑up** – small UI card that shows item name, price, and the 2.5% referral commission.
- **GitHub diff** – at least 3‑5 meaningful commits that add the VR flow, documented in `META_COMPETITION.md`.

## 3. Demo script (2‑minute submission video)
1. Avatar starts in the showroom hub.
2. Browse items with hand gestures; item highlights as gaze/pointer approaches.
3. Select item → try‑on effect plays on avatar.
4. Checkout gesture → receipt pop‑up appears.
5. Share button → short clip auto‑uploads.

## 4. Submission checklist
- [ ] Public GitHub repo with `META_COMPETITION.md` describing new work
- [ ] Quest‑build (`OnPoint/MetaBuild/`) that runs at ≥60 fps on Quest 2
- [ ] 2‑minute demo video (mp4, <15 MB) showing the VR flow
- [ ] Screenshots of the VR showroom (front‑view, gesture close‑up)
- [ ] README in repo with "Meta VR Start Competition 2026" section
- [ ] One‑sentence tagline: "AI‑driven fashion VR where avatars browse, try‑on, and purchase."
- [ ] Optional: Link to live demo `https://onpoint.trustfall.xyz` for prior art context

## 5. Meta‑specific features to highlight
- **Hand‑tracking** – no controllers needed; pure inside‑out interaction.
- **AI‑driven try‑on** – reuse the existing try‑on logic but render to an avatar mesh.
- **ERC‑8004 identity** – mention the on‑chain agent identity as a “future‑proof” element.
- **2.5% referral commission** – a concrete number judges love to see in the receipt pop‑up.

## 6. Risks and fallbacks
- **Shader performance** – fallback to a **video‑based demo** (recorded on a phone) with overlay annotations showing where gestures would occur.
- **New‑work case** – clearly mark the 3‑4 commits that constitute the competition contribution in `META_COMPETITION.md`.
- **Submission window** – register early on Devpost; the competition often has an early‑bird window with extra visibility.

## 6. Suggested timeline (4‑week build)
- **Week 1**: Port OnPoint wardrobe studio to Quest‑compatible shaders; get a static mesh gallery running.
- **Week 2**: Add hand‑tracking gestures (pinch/swipe) and avatar picker.
- **Week 3**: Add try‑on shader + receipt pop‑up; record 2‑min demo video.
- **Week 3‑4**: Write `META_COMPETITION.md`, update README, push all changes.
- **Week 4**: Register on Devpost, submit, share on Twitter/X with #MetaVRStart.

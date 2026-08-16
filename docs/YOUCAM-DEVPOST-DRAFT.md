# YouCam Hackathon — Devpost Submission Fields (drafts)

Paste-ready answers for the Devpost form. Video: https://youtu.be/Y4u5q9jzlPs
Repo: https://github.com/thisyearnofear/onpoint

## Inspiration

Online fashion is a guessing game — will it fit, will it look right, is it
worth the return shipping — and the bill for that guessing is paid in returns:
roughly one in four garments bought online comes back. We were already
building OnPoint, an agent-commerce rail where AI agents shop real merchant
inventory with stablecoin micropayments, when the YouCam hackathon brief
landed, and it described our exact problem: replace the guess with something
closer to certainty. An agent that can *see* the garment on the shopper before
it spends money is the difference between a recommendation engine and a
buyer. So we wired YouCam's Apparel VTO into the one place it changes
behavior: directly in front of a payable offer.

## What it does

OnPoint is a live platform where humans and AI agents shop the same real
inventory. Curators publish storefronts with machine-readable offers (size,
stock, cUSD price). An agent browses a storefront, then requests a paid
try-on over HTTP x402: it pays 3 cents in cUSD on Celo, and in return gets a
YouCam cloth-v4 render of the *actual* listing photo on the *actual* shopper
photo, plus a structured fit signal and a shareable polaroid card. The agent
reads the fit verdict and either checks out on-chain or walks away — no human,
no cart, no returns guess. Every render fee and every purchase lands in a
public reconciled ledger with attribution, so the value of each try-on is
measurable, not claimed. The demo video shows a real end-to-end run: real API
call, real render, real cUSD payment, real ledger entry.

## How we built it

The integration is a self-contained YouCam client
(`apps/api/lib/youcam-vto.js`) implementing the full server-to-server flow:
data-URI inputs are pushed through the File API (presigned PUT → `file_id`),
public URLs pass through as-is; a `cloth-v4` task is created with
`garment_category: "auto"`, polled every 1.5 s, and resolved to a render URL.
The client is plugged into OnPoint's existing try-on engine as the
first-choice provider of the paid tier, with a graceful fallback chain
(YouCam → Replicate IDM-VTON → Venice SD35) so the commerce rail keeps
working even when a provider is down or unconfigured. Around it sit the
existing OnPoint systems: x402 payment challenges on Celo, curator payout
wallets, cost accounting per provider in the funnel analytics, and a suite of
160 unit tests including new coverage for the YouCam success path and the
auth-failure fallback path.

## Challenges we ran into

The biggest mismatch was shape: YouCam cloth-v4 is asynchronous (create task,
poll for result) while an x402 paid request is a single synchronous
HTTP exchange — the agent pays once and expects an answer, not a job handle.
We hid the polling inside the paid request with bounded retries and typed
errors so a slow or failed task degrades cleanly instead of hanging the
payment. Second, shopper photos arrive as base64 data URIs from agents, but
cloth-v4 wants file IDs or URLs; the File API's two-step presigned upload had
to be wired transparently into the try-on path. Third, we had to make the
integration strictly additive: with no API key set, every pre-existing code
path must behave exactly as before, which drove the fallback-reason plumbing
and the 401-failure test.

## Accomplishments that we're proud of

This is not a mock-up: the submission includes a live smoke test against the
real YouCam API (task completed in ~11 s, render returned and displayed), and
a full agent purchase loop where the try-on that gates the sale is a YouCam
render paid for in cUSD on Celo mainnet. We are proud that perception sits at
the actual decision point of a real transaction — the render feeds a fit
signal an agent uses to buy or skip — and that every step (offer, payment,
render, payout) is machine-readable and publicly reconciled. The provider
chain degrades gracefully, the test suite is green, and the whole thing runs
on inventory a human shopper can browse at the same URL.

## What we learned

We learned that generative try-on is most valuable as *infrastructure*, not
as a widget: bolted onto a checkout page it's a novelty, but placed in front
of an executable offer it becomes the agent's eyes, and the quality of the
render directly translates into purchase confidence. Technically we learned
the async-task + micropayment integration pattern (hide the job lifecycle
inside the paid request, type every failure mode, always keep a degraded
path), and we learned how much trust a public ledger adds: being able to show
the exact try-on fee, payout split, and attribution for the render in the demo
made the economics concrete in a way screenshots never could.

## What's next for onpoint

Next we extend the fit loop: use YouCam renders across multiple sizes of the
same listing so the agent (or shopper) gets a size recommendation, not just a
fit/no-fit verdict; bring the same garment-conditioned try-on to the free web
tier so human shoppers get the upgrade path from "similar look" preview to
exact-garment render; and grow the curator base so the ledger reflects real
volume. Longer term, the try-on → conversion data becomes the onboarding
scorecard for new merchants, and the same perception-at-the-decision-point
pattern generalizes beyond fashion to any fit-sensitive physical goods.

## What date did you start this project? (MM-DD-YY) / If Existing, explain what you updated during the submission period

10-24-25. OnPoint began before this hackathon as an agent-commerce rail for fashion (storefronts, machine-readable offers, x402 stablecoin try-ons, and checkout on Celo), so it is submitted as an existing project. During the submission period (Jul 6–Aug 17, 2026) we built and shipped the YouCam Apparel VTO integration: a new `apps/api/lib/youcam-vto.js` client (File API upload, cloth-v4 task creation, polling, typed errors), wiring YouCam cloth-v4 as the first-choice provider in the paid try-on engine with graceful fallback to Replicate IDM-VTON and Venice, `youcam-cloth-v4` cost accounting in the funnel analytics, two new unit tests (success path and auth-failure fallback, keeping the suite at 160 passing), a live smoke-test script that completed a real YouCam render in ~11s, and the demo video, docs, and evidence trail for this submission. All YouCam-specific code and validation work was performed inside the hackathon window.

## Provide a text description explaining the features, functionality, and consumer or retail value of your project.

OnPoint is a live fashion-commerce platform where humans and AI agents shop the same real merchant inventory. Curators publish storefronts with machine-readable offers — size, stock, and cUSD price — and agents execute the full funnel over standard HTTP: browse free, request a paid try-on via x402 (3–5 cents in cUSD on Celo), receive YouCam cloth-v4's garment-conditioned render of the actual listing on the shopper's own photo plus a structured fit signal and a shareable polaroid card, then either check out on-chain or walk away. Every render fee, order payout, and referral commission lands in a public reconciled ledger with ERC-8021 attribution, so try-on-to-purchase economics are verifiable rather than claimed. For consumers, this replaces the fit guess with visual certainty before money moves, cutting return risk and increasing purchase confidence; for retailers and curators, it turns try-ons into a monetized, agent-accessible discovery channel (80% of digital try-on revenue goes to the curator), provides measurable conversion data per provider tier, and opens inventory to autonomous agent buyers without new infrastructure.

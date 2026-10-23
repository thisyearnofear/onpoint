# Research: Game Formats for Messaging Surfaces

**Purpose:** evidence behind [ADR 0022](../adr/0022-runway-game-hosted-messaging.md) (Runway).
**Status:** research input. Trend sources are blogs and platform discovery pages — directional, not rigorous. Academic sources support mechanisms, not the virality of any specific format. Verify before external citation.

## Question

What consumer formats are people responding to, and which one can OnPoint host natively in a messaging thread over its existing primitives (try-on, personas, looks, share attribution, mutating iMessage cards)?

## The primitive

Recent "game in real life" trends (e.g. people physically re-enacting Subway Surfers' lane-switching) share one structure: **a digital game's rules imposed on a real body, recorded and shared.** Fashion already has a proven instance of it.

**Dress to Impress IRL.** Dress to Impress (Roblox, Nov 2023) gives players ~5 minutes to build an outfit for a random theme, then a runway where other players vote. It became a TikTok phenomenon and spilled into real life: people race a timer to build a themed outfit from their own closet ([TikTok discover](https://www.tiktok.com/discover/dress-to-impress-in-real-life), [Wikipedia](https://en.wikipedia.org/wiki/Dress_to_Impress)). Themes track culture (e.g. a "Brat" update after Charli XCX's album), which kept it relevant to older audiences ([The Mycenaean](https://www.themycenaean.org/2024/09/why-is-dress-to-impress-so-popular)).

What IRL players improvise — the theme, the clock, the judge, the scoreboard — is exactly what an AI host in a group chat can supply.

## Supporting signals

| Signal | Evidence | Design implication |
| --- | --- | --- |
| Theme + timer + peer vote | Dress to Impress mechanics and IRL spillover (above) | Core loop |
| Theme-dressing social deduction | "Imposter challenge": a group dresses to a theme, one is secretly the imposter ([Clipchamp, 2026](https://clipchamp.com/en/blog/tiktok-trends-challenges)) | Second mode on the same engine |
| Async group-chat games | GamePigeon spread because turns don't demand real-time presence ([HS Dial](https://hsdial.org/2022/02/09/app-of-the-month-gamepigion)) | Rounds tolerate staggered participation |
| Daily scarcity + spoiler-free share artifact | Wordle: 90 → 2M+ players in ~2 months; 1.2M results shared on Twitter in 13 days; the share grid carried no link ([Wikipedia](https://en.wikipedia.org/wiki/Wordle)) | Typographic result card; optional daily theme |
| Identity reveal | Spotify Wrapped converts data into shareable self-expression ([Futurowise](https://www.futurowise.com/post/the-psychology-of-being-wrapped)) | Later: "Style Wrapped" from round history |
| Forced prompts decay | BeReal's random notification shifted from fun to chore; peaked at 73.5M users ([LSU case study](https://repository.lsu.edu/cgi/viewcontent.cgi?article=2718&context=honors_etd)) | Rounds are user-initiated; no random pushes |
| Messaging agents are a live category | Poke reported 100M messages in three months and became the first third-party agent on Apple Messages for Business ([AI Chat Daily](https://www.aichatdaily.com/ai-business/apple-approves-poke-first-ai-agent-messages-business)) | Distribution exists; platform policy is tightening |

## Academic support (mechanisms)

- **People already text outfit photos for advice.** Shoppers consult others by phone; a field experiment found remote advice via MMS/social/crowd influential ([Morris, Inkpen & Venolia, CSCW 2014](https://doi.org/10.1145/2531602.2531707)). A group-chat runway formalises an existing habit.
- **Try-on intent is driven by enjoyment as much as utility**, and dampened by perceived privacy risk ([Zhang et al., *Internet Research* 2019](https://doi.org/10.1108/intr-12-2017-0540)). Treat try-on as a playful reward; minimise photo retention.
- **Gamification directly raises e-commerce engagement** (n=253 Amazon users; [García-Jurado et al., *ECRA* 2021](https://doi.org/10.1016/j.elerap.2021.101076)).

## Formats considered

| Format | Verdict |
| --- | --- |
| **Runway** (themed closet challenge, AI judge, peer vote, "the fix") | **Chosen.** Physical action, group spread, commerce bridge |
| Fit Imposter (social deduction) | Second mode, same engine |
| Daily theme (Wordle mechanic) | Retention layer |
| Selfie roast (solo critique) | Folded into Runway's solo judge |
| AI try-on transformations ("GRWM") | Commoditised by many apps; use as reward, not product |

## Channel facts (verified against vendor docs, Oct 2026)

**Linq (current iMessage provider)** — [docs](https://docs.linqapp.com/channel/imessage/):
- Group chats of 3–31 participants via `POST /v3/chats` with multiple `to` handles; participants can be added/removed (iMessage only). Delivery and read receipts are not available in groups.
- Native iMessage **polls** (`POST /v3/chats/{chatId}/polls`) with `poll.vote.added` webhooks; a poll cannot be a chat's first message; options are add-only.
- Reactions, mentions, typing indicators, message effects, chat backgrounds, contact-card sharing.
- **Experiences:** native cards rendered by Linq's own iMessage app, including `agentpay` (`request_payment`) that flips to "Paid" in place.
- Best practices: inbound-first; **no links or media in the first outbound message**; aim for 3+ early replies and ~1:2 inbound:outbound; ≤7,000 messages/day per line; honour opt-out (error `2024`); send without pinning `from`.

**Photon Spectrum** — [docs](https://photon.codes/docs/spectrum-ts/introduction):
- One agent server, many providers: iMessage (managed lines; DMs, groups, reactions, threaded replies, effects), WhatsApp Business, Telegram, terminal, SIP voice.
- Already a dependency: `packages/messaging-bridge` wraps `spectrum-ts` for curator WhatsApp commands (`apps/api/agent-server.js`).

## Market caveat

OnPoint's curators sell in Kenya (KES, M-Pesa), where WhatsApp dominates and iMessage penetration is low. The iMessage line reaches an iPhone-heavy, mostly US audience. iMessage is therefore an attention and brand channel; WhatsApp is the commerce channel. The game engine must be channel-agnostic.

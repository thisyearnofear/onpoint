# Invite-Flow Teardown: Look Share Loop

Purpose: walk the share → visit → try-on → order path step by step, record friction, and keep a ranked fix list. Metric definitions live in [growth-loop.md](./growth-loop.md).

## Baseline findings (initial code audit)

Found by reading the code, not by running the flow with users. Re-verify each on a deployed build.

| # | Step                         | Finding                                                                                                                                  | Status                                            |
| - | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1 | Share click                  | `ShareBar` never called `POST /api/looks/:slug/share`, so `share_count` stayed at 0 from the web                                          | Fixed: each click records a share                 |
| 2 | Share URL                    | Share URLs had no id or channel, so a visit could not be tied to a share                                                                  | Fixed: `?sid=…&utm_source=…`                      |
| 3 | Look page visit              | No visit event for the look page                                                                                                          | Fixed: `look_visit`                               |
| 4 | CTA click                    | No event for "Try it on" / "Shop the pieces"                                                                                              | Fixed: `look_cta`; `sid` forwarded in the link    |
| 5 | Referral landing `/r/[code]` | Page posted `{ referralCode, action: 'visit' }` but `/api/referrals/capture` required `agentAddress` + `storefrontSlug`, so it returned 400 and the visit was lost | Fixed: logs `referral_visit`                      |
| 6 | Storefront arrival           | `/s/[slug]` did not read `sid`, `referral` or `look`, so attribution ended at the CTA click for humans                                     | Fixed for `sid` + `look`: arrival, try-on/buy clicks and payment start reported; web try-on carries the share id. `referral` is still ignored |
| 7 | Human purchase               | Human checkout is WhatsApp/M-Pesa and carried no attribution                                                                              | Fixed for M-Pesa STK push: share id stored on the payment, confirmed sale recorded server-side. Manual M-Pesa codes and WhatsApp-only sales **open** |
| 8 | Agent order referral         | Self-referral was paid; an unknown referral code was stored as the agent address                                                           | Self-referral fixed; unknown-code fallback **open** |
| 9 | Share card / polaroid        | Share cards created on look try-on are not linked to a share id                                                                           | **Open**                                          |

Statuses describe the repository. Confirm each against the deployed build before relying on it: the API changes and the web changes deploy separately.

## How to run the teardown

Do this on a deployed build with analytics access. Use a fresh browser profile for the recipient.

1. **Share.** On a live look, click each of Copy link, Tweet, WhatsApp. Confirm a `look_share` event per click and that the copied URL carries `sid` and `utm_source`.
2. **Visit.** Open the shared URL as a different visitor. Confirm exactly one `look_visit` with the same `sid`. Reload and confirm no second one.
3. **CTA.** Click "Try it on" and "Shop the pieces". Confirm a `look_cta` per click (`kind` = `tryon` / `shop`) and that the storefront URL contains `&sid=` and `&look=`.
3c. **Outcomes.** From the storefront, run a web try-on in the same tab and confirm a `tryon_complete` (source `web`) with the same `sid`. Complete an STK push in the sandbox and confirm one `look_storefront` `sale` after the callback, and still only one after replaying the callback.
3b. **Storefront.** On the storefront confirm one `look_storefront` `arrive`, then click "Try with AI" (`tryon`), an external checkout link (`buy`), and start an M-Pesa payment (`order`).
4. **Agent path.** Run `scripts/agent-tryon.mjs` with a `shareId`, then an order with `X-Share-Id`. Confirm both appear under that `sid`.
5. **Report.** Call `GET /api/status/funnel/share?days=1` and check the counts match what you did by hand.

For each step record: time to complete, drop-off (who stopped), and any confusion. Put the notes in the table below.

## Session log

| Date | Build | Step | Observation | Drop-off | Fix proposed |
| ---- | ----- | ---- | ----------- | -------- | ------------ |
|      |       |      |             |          |              |

## Fix backlog (ranked by funnel position)

1. **Manual M-Pesa and WhatsApp sales (finding 7).** Give manual payments a confirmation path (curator marks verified → ledger → `sale`), and decide how WhatsApp-only sales get a share id. Until then they are invisible to the loop.
2. **Share after try-on (finding 9).** Offer sharing the try-on polaroid straight from the result, with a fresh `sid`.
3. **Unknown referral code (finding 8).** Reject or ignore a referral code with no matching agent instead of storing the code as an address.
4. **ChatGPT plugin links.** Add `utm_source=chatgpt` and a `sid` to deep-links returned by the MCP `get_look` tool.

Change one thing per week and compare `overall.conversion` and per-channel `k` before and after.

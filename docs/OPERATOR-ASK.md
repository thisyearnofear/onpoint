# Outside-operator ask — draft message

Send to: a friend, another hackathon team, or someone in NEAR TG/Discord.
Time cost for them: ~10 minutes. They keep whatever their storefront earns.

---

Hey — I'm submitting OnPoint to the NEAR hackathon (deadline Nov 14) and the
one thing I can't fake is an independent operator. Want to run a storefront
merchant agent against my live API for 10 minutes?

**What you'd do:**

1. Create a NEAR testnet account (MyNearWallet or `near-cli-rs`, ~2 min).
   Keep the key — I never see it.
2. `git clone https://github.com/thisyearnofear/onpoint && cd onpoint`
3. `cd scripts/near-spike && npm i` (or use the repo's installed deps)
4. Run:

   ```
   API_URL=https://api.onpoint.famile.xyz \
   SELLER=<your>.testnet SELLER_KEY=ed25519:<your-key> \
   node seller-agent.mjs
   ```

5. Leave it running ~15 min while I run a buyer demo against it.

**What happens:** a buying agent negotiates with *your* process — you can
refuse, counter, and sign price quotes with your own key. Then it
publishes a signed payment intent; your process executes it on-chain and
withdraws the proceeds to your wallet. The platform never holds your key —
that's the whole point I'm proving.

**What you get:** mock USDC on testnet (worthless but real transactions),
plus my gratitude and a shoutout in the submission. Optionally: register a
real storefront listing for yourself via
`POST /api/curator/{slug}/near-account` — the runbook is
`docs/RUN-YOUR-OWN-MERCHANT.md`.

---

## Optional upgrade: same thing on mainnet (real USDC)

If you're willing to create a **mainnet** account instead, the same run
settles real USDC on `intents.near` (the canonical verifier — the
"grand-prize" version of the story). You keep the ~$2 the buyer pays.

Steps are identical except:

- account: `<you>.near` (mainnet wallet) instead of testnet
- env: `NEAR_NETWORK=mainnet` on the seller-agent line
- I send you 0.15 NEAR gas money — that's it

Then the receipt shows a real USDC payment on
`nearblocks.io` (mainnet) to an account I provably don't control.

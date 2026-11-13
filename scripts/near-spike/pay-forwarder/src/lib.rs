// Minimal escrow forwarder for the OnPoint scoped-key demo.
//
// Why this exists: NEAR function-call access keys sign transactions with
// zero attached deposit, but NEP-141 ft_transfer requires 1 yoctoNEAR.
// So the agent's scoped key cannot call the FT contract directly.
// Instead the agent escrows USDC.e here (registered as a normal FT
// receiver), and this contract's `pay` method releases tokens to an
// allow-listed payee, attaching the required 1 yoctoNEAR from its own
// balance.
//
// Security model (all enforced on-chain):
//   - only AGENT may be the predecessor (the scoped key can't spoof it)
//   - receiver must be in PAYEES
//   - amount is bounded per call by MAX_PER_TX
//   - no attached deposit allowed
//   - escrow balance check is enforced by the FT contract itself
//
// Written with raw extern exports (no #[near] macro glue) so the entire
// code path is visible here — nothing generated.

use near_sdk::serde::Deserialize;
use near_sdk::{env, AccountId, Gas, NearToken};
use near_sdk::serde_json::{self, json};

const FT_CONTRACT: &str = "usdc.fakes.testnet";
const AGENT: &str = "agent.onpoint.testnet";
const PAYEES: &[&str] = &[
    "store.onpoint.testnet",
    "curator.onpoint.testnet",
    "onpoint.testnet",
];
/// Per-call spend cap in token base units: 25 USDC.e at 6 decimals.
/// "Can empty escrow in one call" becomes "bounded per-call AND bounded
/// by escrow" — a compromised or buggy agent can move at most this much
/// per transaction no matter what the escrow holds.
const MAX_PER_TX: u128 = 25_000_000;

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct PayArgs {
    receiver_id: String,
    amount: String,
}

#[no_mangle]
pub extern "C" fn pay() {
    env::log_str("pay: enter");

    if env::attached_deposit() != NearToken::from_yoctonear(0) {
        env::panic_str("no deposit may be attached");
    }
    env::log_str("pay: deposit ok");

    if env::predecessor_account_id().as_str() != AGENT {
        env::panic_str("predecessor must be the agent");
    }
    env::log_str("pay: predecessor ok");

    let input = match env::input() {
        Some(bytes) => bytes,
        None => env::panic_str("missing input"),
    };
    let args: PayArgs =
        serde_json::from_slice(&input).unwrap_or_else(|_| env::panic_str("invalid args"));

    if !PAYEES.iter().any(|p| *p == args.receiver_id) {
        env::panic_str("receiver is not on the payee allow-list");
    }
    env::log_str("pay: payee ok");

    let amount: u128 = args
        .amount
        .parse()
        .unwrap_or_else(|_| env::panic_str("amount must be a base-unit integer"));
    if amount == 0 {
        env::panic_str("amount must be positive");
    }
    if amount > MAX_PER_TX {
        env::panic_str("amount exceeds per-call cap");
    }
    env::log_str("pay: amount within per-call cap");

    let ft: AccountId = FT_CONTRACT
        .parse()
        .unwrap_or_else(|_| env::panic_str("ft contract id misconfigured"));

    let call_args = json!({
        "receiver_id": args.receiver_id,
        "amount": amount.to_string(),
    })
    .to_string()
    .into_bytes();

    let p = env::promise_batch_create(&ft);
    env::promise_batch_action_function_call(
        p,
        "ft_transfer",
        &call_args,
        NearToken::from_yoctonear(1),
        Gas::from_tgas(15),
    );
    env::promise_return(p);
    env::log_str("pay: promise returned");
}

#[no_mangle]
pub extern "C" fn ping() {
    env::log_str("ping");
    env::value_return(b"pong");
}

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
// v2: the spend policy is owner-managed state, not compile-time
// constants — the operator can add/remove payees, rotate the agent, and
// retune the per-call cap on-chain without redeploying.
//
// Security model (all enforced on-chain):
//   - only the configured agent may be `pay`'s predecessor
//   - receiver must be on the managed payee allow-list
//   - amount is bounded per call by the configured cap
//   - no attached deposit allowed
//   - admin ops are gated to the owner account
//   - init is one-time and only callable by the contract itself
//   - escrow balance check is enforced by the FT contract itself
//
// Written with raw extern exports (no #[near] macro glue) so the entire
// code path is visible here — nothing generated.

use near_sdk::serde::Deserialize;
use near_sdk::serde_json::{self, json};
use near_sdk::{env, AccountId, Gas, NearToken};

const K_OWNER: &[u8] = b"owner";
const K_AGENT: &[u8] = b"agent";
const K_TOKEN: &[u8] = b"token";
const K_MAX: &[u8] = b"max";
const K_PAYEES: &[u8] = b"payees";
const MAX_PAYEES: usize = 64;

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct InitArgs {
    owner: String,
    agent: String,
    token: String,
    max_per_tx: String,
    payees: Vec<String>,
}

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct AccountArg {
    account_id: String,
}

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct AmountArg {
    amount: String,
}

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct PayArgs {
    receiver_id: String,
    amount: String,
}

fn args<T: for<'de> Deserialize<'de>>() -> T {
    let input = env::input().unwrap_or_else(|| env::panic_str("missing input"));
    serde_json::from_slice(&input).unwrap_or_else(|_| env::panic_str("invalid args"))
}

fn read_str(key: &[u8]) -> String {
    let raw = env::storage_read(key).unwrap_or_else(|| env::panic_str("contract not initialized"));
    String::from_utf8(raw).unwrap_or_else(|_| env::panic_str("corrupt state"))
}

fn read_payees() -> Vec<String> {
    let raw = env::storage_read(K_PAYEES).unwrap_or_else(|| env::panic_str("contract not initialized"));
    serde_json::from_slice(&raw).unwrap_or_else(|_| env::panic_str("corrupt payees"))
}

fn write_payees(payees: &[String]) {
    let raw = serde_json::to_vec(payees).unwrap_or_else(|_| env::panic_str("serialize payees"));
    env::storage_write(K_PAYEES, &raw);
}

fn parse_amount(s: &str) -> u128 {
    s.parse().unwrap_or_else(|_| env::panic_str("amount must be a base-unit integer"))
}

fn valid_account(id: &str) {
    id.parse::<AccountId>()
        .unwrap_or_else(|_| env::panic_str("invalid account id"));
}

fn require_owner() {
    if env::predecessor_account_id().as_str() != read_str(K_OWNER) {
        env::panic_str("owner only");
    }
}

fn require_no_deposit() {
    if env::attached_deposit() != NearToken::from_yoctonear(0) {
        env::panic_str("no deposit may be attached");
    }
}

#[no_mangle]
pub extern "C" fn init() {
    if env::storage_read(K_OWNER).is_some() {
        env::panic_str("already initialized");
    }
    if env::predecessor_account_id() != env::current_account_id() {
        env::panic_str("init must be called by the contract account itself");
    }
    require_no_deposit();

    let a: InitArgs = args();
    valid_account(&a.owner);
    valid_account(&a.agent);
    valid_account(&a.token);
    if parse_amount(&a.max_per_tx) == 0 {
        env::panic_str("max_per_tx must be positive");
    }
    if a.payees.is_empty() || a.payees.len() > MAX_PAYEES {
        env::panic_str("payees must be 1..=64");
    }
    for p in &a.payees {
        valid_account(p);
    }

    env::storage_write(K_OWNER, a.owner.as_bytes());
    env::storage_write(K_AGENT, a.agent.as_bytes());
    env::storage_write(K_TOKEN, a.token.as_bytes());
    env::storage_write(K_MAX, a.max_per_tx.as_bytes());
    write_payees(&a.payees);
    env::log_str("init: state written");
}

#[no_mangle]
pub extern "C" fn add_payee() {
    require_no_deposit();
    require_owner();
    let a: AccountArg = args();
    valid_account(&a.account_id);
    let mut payees = read_payees();
    if !payees.iter().any(|p| *p == a.account_id) {
        if payees.len() >= MAX_PAYEES {
            env::panic_str("payee list full");
        }
        payees.push(a.account_id);
        write_payees(&payees);
    }
    env::log_str("add_payee: ok");
}

#[no_mangle]
pub extern "C" fn remove_payee() {
    require_no_deposit();
    require_owner();
    let a: AccountArg = args();
    let mut payees = read_payees();
    payees.retain(|p| *p != a.account_id);
    write_payees(&payees);
    env::log_str("remove_payee: ok");
}

#[no_mangle]
pub extern "C" fn set_agent() {
    require_no_deposit();
    require_owner();
    let a: AccountArg = args();
    valid_account(&a.account_id);
    env::storage_write(K_AGENT, a.account_id.as_bytes());
    env::log_str("set_agent: ok");
}

#[no_mangle]
pub extern "C" fn set_max_per_tx() {
    require_no_deposit();
    require_owner();
    let a: AmountArg = args();
    if parse_amount(&a.amount) == 0 {
        env::panic_str("amount must be positive");
    }
    env::storage_write(K_MAX, a.amount.as_bytes());
    env::log_str("set_max_per_tx: ok");
}

#[no_mangle]
pub extern "C" fn set_owner() {
    require_no_deposit();
    require_owner();
    let a: AccountArg = args();
    valid_account(&a.account_id);
    env::storage_write(K_OWNER, a.account_id.as_bytes());
    env::log_str("set_owner: ok");
}

#[no_mangle]
pub extern "C" fn get_state() {
    let state = json!({
        "owner": read_str(K_OWNER),
        "agent": read_str(K_AGENT),
        "token": read_str(K_TOKEN),
        "max_per_tx": read_str(K_MAX),
        "payees": read_payees(),
    })
    .to_string();
    env::value_return(state.as_bytes());
}

#[no_mangle]
pub extern "C" fn pay() {
    env::log_str("pay: enter");

    require_no_deposit();
    env::log_str("pay: deposit ok");

    if env::predecessor_account_id().as_str() != read_str(K_AGENT) {
        env::panic_str("predecessor must be the agent");
    }
    env::log_str("pay: predecessor ok");

    let a: PayArgs = args();

    if !read_payees().iter().any(|p| *p == a.receiver_id) {
        env::panic_str("receiver is not on the payee allow-list");
    }
    env::log_str("pay: payee ok");

    let amount = parse_amount(&a.amount);
    if amount == 0 {
        env::panic_str("amount must be positive");
    }
    if amount > parse_amount(&read_str(K_MAX)) {
        env::panic_str("amount exceeds per-call cap");
    }
    env::log_str("pay: amount within per-call cap");

    let ft: AccountId = read_str(K_TOKEN)
        .parse()
        .unwrap_or_else(|_| env::panic_str("token contract id misconfigured"));

    let call_args = json!({
        "receiver_id": a.receiver_id,
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

import { Account, JsonRpcProvider, KeyPairSigner, nearToYocto } from "near-api-js";
import { readFileSync, writeFileSync } from "fs";
const API = "https://api.onpoint.famile.xyz";
const creds = JSON.parse(readFileSync("near-credentials.testnet.json", "utf8"));
const a = creds.accounts.agent;
const provider = new JsonRpcProvider({ url: "https://rpc.testnet.near.org" });
const acct = new Account(a.accountId, provider, KeyPairSigner.fromSecretKey(a.privateKey || a.secretKey));

const body = (extra) => JSON.stringify({
  curatorSlug: "onpoint-store",
  listingId: "0cc69356-68f1-4466-86f8-9db6b440d70a",
  photoData: readFileSync("/tmp/test-person.b64", "utf8"),
  ...extra,
});
const post = (extra) => fetch(`${API}/api/agent/try-on`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: body(extra),
});

const r1 = await post({});
const q = await r1.json();
console.log("1st:", r1.status, JSON.stringify(q.near || q.quote?.near || q).slice(0, 300));
const near = q.near || q.quote?.near;
if (!near) { console.log("no near rail — quote was:", JSON.stringify(q).slice(0, 400)); process.exit(1); }
const out = await acct.transfer({ receiverId: near.accountId, amount: BigInt(near.amountYocto ?? near.amount) });
const txHash = out.transaction?.hash ?? out.transaction_outcome?.id;
console.log("paid:", txHash, "→", near.accountId);
const r2 = await post({ nearAccountId: a.accountId, nearTxHash: txHash, quoteId: q.quoteId ?? q.quote?.quoteId });
const d2 = await r2.json();
console.log("2nd:", r2.status, JSON.stringify(d2).slice(0, 300));

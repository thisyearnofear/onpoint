import { Account, JsonRpcProvider, KeyPair, KeyPairSigner, nearToYocto } from "near-api-js";
const provider = new JsonRpcProvider({ url: "https://rpc.testnet.near.org" });
const TARGET = "agent.onpoint.testnet";
const id = `topup-${Date.now().toString(36)}.testnet`;
const keyPair = KeyPair.fromRandom("ed25519");
const res = await fetch("https://helper.testnet.near.org/account", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ newAccountId: id, newAccountPublicKey: keyPair.getPublicKey().toString() }),
});
if (!res.ok) throw new Error(`helper: ${res.status}`);
console.log("funded helper account:", id);
const acct = new Account(id, provider, KeyPairSigner.fromSecretKey(keyPair.toString()));
const out = await acct.transfer({ receiverId: TARGET, amount: nearToYocto("3") });
console.log("sent 3 NEAR →", TARGET, "| tx:", out.transaction?.hash);

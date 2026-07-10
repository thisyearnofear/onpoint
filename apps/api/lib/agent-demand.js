/**
 * Classify agent commerce callers for Phase 1 demand metrics.
 * Own platform agent wallet ≠ third-party usage (STRATEGY.md).
 */

const agentCore = require('@repo/agent-core');

function normalizeAddress(addr) {
  if (!addr || typeof addr !== 'string') return '';
  return addr.toLowerCase();
}

/** Platform / own-agent wallet addresses that do not count as third-party demand. */
function ownAgentAddresses() {
  const set = new Set();
  const candidates = [
    agentCore.AGENT_WALLET,
    agentCore.PLATFORM_WALLET,
    process.env.AGENT_WALLET_ADDRESS,
  ];
  for (const a of candidates) {
    const n = normalizeAddress(a);
    if (n.startsWith('0x') && n.length === 42) set.add(n);
  }
  return set;
}

/**
 * @param {string | undefined | null} payerAddress — on-chain payer / buyer
 * @returns {'own' | 'third_party'}
 */
function classifyAgentCaller(payerAddress) {
  const n = normalizeAddress(payerAddress);
  if (!n) return 'third_party'; // unknown payer — treat as external until proven own
  return ownAgentAddresses().has(n) ? 'own' : 'third_party';
}

/**
 * Record Prometheus-style action + structured log fields for demand proof.
 * @param {'try_on' | 'order'} kind
 * @param {'own' | 'third_party'} caller
 * @param {'attempted' | 'succeeded' | 'failed'} status
 */
function recordAgentDemand(kind, caller, status = 'succeeded') {
  const action = `agent_${kind}_${caller}`;
  if (agentCore.Metrics?.countAction) {
    agentCore.Metrics.countAction(action, status);
    // Aggregate counter for dashboards that only watch one series
    if (caller === 'third_party') {
      agentCore.Metrics.countAction(`agent_${kind}_third_party_total`, status);
    }
  }
  return { caller, action };
}

module.exports = {
  classifyAgentCaller,
  recordAgentDemand,
  ownAgentAddresses,
};

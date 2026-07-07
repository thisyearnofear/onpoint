/**
 * @repo/agent-core — Barrel Export
 *
 * Consolidated agent infrastructure extracted from apps/web/lib/.
 * All agent services, controls, stores, and utilities.
 *
 * Import via: import { ... } from "@repo/agent-core";
 */

// ── Chain Configuration ──
export {
  type ChainName,
  AGENT_WALLET,
  PLATFORM_WALLET,
  base,
  celo,
  celoSepolia,
  RPC_URLS,
  EXPLORER_URLS,
  TOKEN_ADDRESSES,
  NFT_CONTRACTS,
  SUPERFLUID_CFA_FORWARDER,
  getExplorerUrl,
  getTokenAddress,
  getNFTContract,
  getGTokenAddress,
  getSuperfluidCFAForwarder,
  isSuperfluidNativeToken,
  supportsCUSD,
  supportsNFTMinting,
  createTransport,
} from "./chains";

// ── Utilities ──
export { logger } from "./logger";
export {
  redisGet,
  redisSet,
  redisSetEx,
  redisDel,
  redisIncr,
  redisSadd,
  redisSmembers,
  redisSrem,
  redisScan,
  isRedisConfigured,
} from "./redis-helpers";
export {
  readPersistentState,
  writePersistentState,
  clearPersistentStateCache,
} from "./persistent-state";
export {
  getAgentApiUrl,
  fetchAgentApi,
  getAgentApi,
  postAgentApi,
  patchAgentApi,
} from "./agent-api";

// ── Agent Controls & Store ──
export {
  type ActionType,
  type SpendingLimit,
  type ApprovalRequest,
  type AgentControlsConfig,
  type SuggestionStatus,
  type AgentSuggestion,
  type StylePreference,
  type StyleRecommendation,
  AgentControls,
  initStore,
  initializeAgentLimits,
  getAgentLimits,
  checkSpendingLimit,
  recordSpending,
  recordSpendingWithEscrow,
  getRemainingLimit,
  setAutonomyThreshold,
  getAutonomyThreshold,
  isBelowAutonomyThreshold,
  createSuggestion,
  getSuggestion,
  acceptSuggestion,
  rejectSuggestion,
  markSuggestionExecuted,
  getPendingSuggestions,
  getStylePreferences,
  updateStylePreferences,
  trackStyleInteraction,
  validateAction,
  validateActionWithEscrow,
  suggestAction,
  createApprovalRequest,
  getApprovalRequest,
  approveRequest,
  rejectRequest,
  getPendingApprovals,
  dispatchExternalAction,
  loadSuggestionFromStore,
  persistSuggestion,
} from "./agent-controls";

export {
  loadSpendingLimits,
  persistSpendingLimits,
  loadAutonomyThreshold,
  persistAutonomyThreshold,
  persistSuggestion as persistSuggestionToStore,
  loadSuggestion,
  loadSuggestionIds,
  persistApproval,
  loadApproval,
  loadApprovalIds,
  persistStylePreferences,
  loadStylePreferences,
  persistCommission,
  loadCommission,
  loadCommissionIds,
  hydrateSuggestions,
  hydrateApprovals,
} from "./agent-store";

// ── Agent Wallet ──
export {
  AgentWalletService,
  type WalletInfo,
  getAgentWallet,
  getAgentWalletInfo,
  getOWSWalletInfo,
} from "./agent-wallet";

// ── Agent Registry (ERC-8004) ──
export {
  type AgentAction,
  type AgentReceipt,
  type AgentIdentity,
  getAgentIdentity,
  recordReceipt,
  getSessionReceipts,
  getAllReceipts,
  getReceipt,
  getOnChainReceipts,
  generateReceiptVerifiableData,
} from "./agent-registry";

// ── Fraud Detection ──
export {
  type AgentHealthCheck,
  type TransactionPattern,
  type FraudAlert,
  type MultiSigRequirement,
  recordHeartbeat,
  checkAgentHealth,
  analyzeTransactionPattern,
  updateAnomalyScore,
  freezeAgent,
  unfreezeAgent,
  isAgentFrozen,
  requiresMultiSig,
  createMultiSigRequirement,
  addMultiSigSignature,
  getMultiSigRequirement,
  createAlert,
  getAlert,
  resolveAlert,
} from "./fraud-detection";

// ── Escrow Service ──
export {
  type EscrowBalance,
  type EscrowDeposit,
  type EscrowWithdrawal,
  getEscrowBalance,
  initializeEscrow,
  depositToEscrow,
  canSpendFromEscrow,
  deductFromEscrow,
  updateAllowance,
  withdrawFromEscrow,
  resetDailySpending,
} from "./escrow-service";

// ── Verifiable Agent Service (IPFS/Filecoin) ──
export {
  VerifiableAgentService,
  type AgentReceipt as VerifiableAgentReceipt,
} from "./verifiable-agent-service";

// ── Agent Reputation ──
export {
  AgentReputationService,
  type AgentReputation,
  type ReputationConfig,
  REPUTATION_CONFIG,
  agentReputation,
} from "./agent-reputation";

// ── Autonomous Executor ──
export {
  type ExecutionResult,
  executeSuggestion,
} from "./autonomous-executor";

// ── Auto-Rebalance Escrow Detection ──
export {
  type RebalanceCandidate,
  type RebalanceReason,
  type RebalanceStats,
  detectRebalanceCandidates,
  getRebalanceStats,
  updateRebalanceMetrics,
  AutoRebalance,
} from "./auto-rebalance";

// ── ERC-20 Utilities ──
export {
  type ERC20Balance,
  type TransferParams,
  type ApproveParams,
  type TokenTransferResult,
  ERC20,
  getERC20Balance,
  getAllowance,
  getCUSDAddress,
  transferToken,
  approveToken,
  transferCUSD,
} from "./erc20";

// ── Commissions ──
export {
  type CommissionRecipient,
  type CommissionSplit,
  type CommissionRecord,
  calculateSplit,
  createCommissionRecord,
} from "./commissions";

// ── Agent Metrics (Prometheus) ──
export {
  type ActionStatus,
  type ActionCounter,
  type LatencyHistogram,
  type EscrowSnapshot,
  type MetricsSnapshot,
  Metrics,
  countAction,
  recordLatency,
  setEscrowBalance,
  getActionCounters,
  getLatencyHistograms,
  getEscrowBalances,
  exportPrometheus,
  persistMetrics,
  resetMetrics,
} from "./metrics";

// ── Signer Client (ADR 0001 Phase 4) ──
export {
  type SignerHealth,
  type SignTransferParams,
  type SignMintParams,
  type SignContractParams,
  type SignerTransferResult,
  type SignerMintResult,
  type SignerErrorResult,
  type SignerHealthResult,
  SignerClient,
  getSignerClient,
  createSignerClient,
} from "./signer-client";

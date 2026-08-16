const CUSD_PAYMENT_METHOD = 'cusd';
const FACILITATOR_PAYMENT_METHOD = 'x402_facilitator';
const SPLIT_PAYMENT_METHOD = 'split';
const REFUND_STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  MANUAL_REVIEW: 'manual_review',
});

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || ''));
}

function paymentMethodForOrder({ usingSplit, settlementTxHash }) {
  if (usingSplit) return SPLIT_PAYMENT_METHOD;
  if (settlementTxHash) return FACILITATOR_PAYMENT_METHOD;
  return CUSD_PAYMENT_METHOD;
}

function paymentAssetForOrder({ usingSplit, settlementTxHash, cusdAsset, usdcAsset }) {
  if (settlementTxHash) return usdcAsset;
  return cusdAsset;
}

/** Convert a non-negative decimal currency string to exact atomic units. */
function decimalToAtomic(value, decimals = 18) {
  const text = String(value ?? '');
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error('Invalid decimal amount');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) {
    throw new Error('Amount has too many significant decimal places');
  }
  return BigInt(whole) * (10n ** BigInt(decimals))
    + BigInt((fraction.slice(0, decimals) + '0'.repeat(decimals)).slice(0, decimals) || '0');
}

/**
 * Automatic refunds are deliberately limited to platform-custodied cUSD.
 * Split and facilitator payments need rail-specific operator handling until
 * their refund transfer paths are implemented and reconciled.
 */
function isAutomaticCusdRefundEligible(order, { cusdAsset } = {}) {
  const amountText = String(order?.amountCusd ?? '');
  let validAmount = false;
  try {
    decimalToAtomic(amountText, 18);
    validAmount = BigInt(amountText.split('.')[0]) > 0n || /\.[0-9]*[1-9]/.test(amountText);
  } catch {
    validAmount = false;
  }
  return Boolean(
    order?.source === 'agent'
      && order?.status === 'cancelled'
      && order?.paymentMethod === CUSD_PAYMENT_METHOD
      && (!cusdAsset || order?.paymentAsset === cusdAsset)
      && isAddress(order?.buyerAddress)
      && validAmount
      && !order?.refundTxHash
      && [null, undefined, REFUND_STATUS.PENDING, REFUND_STATUS.FAILED].includes(order?.refundStatus),
  );
}

module.exports = {
  CUSD_PAYMENT_METHOD,
  FACILITATOR_PAYMENT_METHOD,
  SPLIT_PAYMENT_METHOD,
  REFUND_STATUS,
  isAddress,
  paymentMethodForOrder,
  paymentAssetForOrder,
  decimalToAtomic,
  isAutomaticCusdRefundEligible,
};

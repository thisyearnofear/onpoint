# MiniPay Integration Guide

This document explains the MiniPay integration added to OnPoint for Proof of Ship eligibility.

## What Was Implemented

### 1. MiniPay Detection Hook (`lib/hooks/useMiniPay.ts`)
- Detects when the app is running inside MiniPay wallet
- Auto-connects to MiniPay wallet when detected
- Returns `isMiniPay` flag for conditional rendering

### 2. MiniPay Provider (`components/MiniPayProvider.tsx`)
- Wraps the app to handle MiniPay auto-connection at the provider level
- Ensures wallet is connected before components render

### 3. Enhanced Connect Button Update (`components/EnhancedConnectButton.tsx`)
- Hides the "Connect Wallet" button when in MiniPay (wallet is auto-connected)
- Maintains all existing functionality for non-MiniPay environments

### 4. MiniPay Utilities (`lib/utils/minipay.ts`)
- Helper functions for MiniPay-specific transactions
- Token addresses for fee abstraction (USDm, cUSD, USDT)
- Transaction sending with fee currency support

## How It Works

When a user opens OnPoint inside MiniPay:
1. `window.ethereum.isMiniPay` is `true`
2. The app automatically connects to the MiniPay wallet
3. The "Connect Wallet" button is hidden (connection is implicit)
4. All transactions use MiniPay's injected provider

## Testing MiniPay Integration

### Prerequisites
- Install MiniPay on Android or iOS
- Enable Developer Mode in MiniPay settings

### Steps
1. Build and deploy your app (or use ngrok for local testing)
2. Open MiniPay app
3. Go to Settings → Developer Settings
4. Enable Developer Mode
5. Toggle "Use Testnet" for Celo Sepolia testing
6. Tap "Load Test Page"
7. Enter your app URL
8. The app should auto-connect and hide the connect button

## Fee Abstraction

MiniPay supports fee abstraction using stablecoins. To use USDm for gas fees:

```typescript
import { sendMiniPayTransaction, USDM_ADDRESS } from "@/lib/utils/minipay";

const hash = await sendMiniPayTransaction({
  to: recipientAddress,
  value: parseEther("0.01"),
  feeCurrency: USDM_ADDRESS, // Pay gas in USDm
});
```

## Important Notes

- MiniPay only supports legacy transactions (no EIP-1559)
- Always verify `window.ethereum` exists before accessing
- MiniPay injects only one address in the accounts array
- Use viem or wagmi for transactions (ethers.js does not work in MiniPay)

## Proof of Ship Eligibility

With this integration:
- ✅ MiniPay hook implemented (counts as Booster in leaderboard)
- ✅ Celo mainnet deployment with verified contracts
- ✅ AI Agent functionality
- ✅ B2C app with real utility
- ✅ Open source (MIT license)

## Next Steps

1. **Deploy to production** with the MiniPay integration
2. **Register on talent.app** (see PROOF_OF_SHIP_REGISTRATION.md)
3. **Test in MiniPay** using developer mode
4. **Submit for Proof of Ship** AI Agent track

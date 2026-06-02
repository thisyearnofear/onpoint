# Secure Agent Wallet Setup Guide

This guide explains how to securely set up and manage the OnPoint agent wallet for ERC-8004 registration.

## Security Principles

1. **Never commit private keys to git** - `.env.local` is already in `.gitignore`
2. **Never log private keys** - Use environment variables, never print them
3. **Use separate wallets** - Agent wallet should be different from personal wallet
4. **Minimal funding** - Only keep necessary funds for operations
5. **Regular rotation** - Consider rotating keys periodically

## Setup Options

### Option 1: Generate New Wallet (Recommended)

```bash
cd apps/web
node scripts/generate-agent-wallet.mjs
```

This will:
- Generate a cryptographically secure private key
- Derive the wallet address
- Provide clear instructions (without logging the key)

**Follow the on-screen instructions to:**
1. Copy the private key to a secure password manager
2. Add it to `.env.local`
3. Update the wallet address in code

### Option 2: Use Existing Wallet

If you have an existing wallet with funds:

1. Export the private key from your wallet (MetaMask, etc.)
2. Add to `.env.local`:
   ```
   AGENT_PRIVATE_KEY=0x<your_64_character_hex_private_key>
   ```
3. Update `apps/web/config/chains.ts` with the wallet address

## Environment Configuration

### `.env.local` Structure

```env
# Agent Wallet (NEVER commit this file)
AGENT_PRIVATE_KEY=0x<64_hex_characters>

# Other keys...
AUTH0_SECRET=...
GEMINI_API_KEY=...
```

### Validation

Run the validation script to check your configuration:

```bash
node scripts/check-agent-wallet.mjs
```

This will:
- Check wallet balance
- Verify private key format
- Confirm readiness for registration

## ERC-8004 Registration

Once your wallet is configured and funded:

```bash
cd apps/web
node scripts/register-erc8004-agent.mjs
```

The script will:
1. Validate private key format (without exposing it)
2. Check wallet balance
3. Register on Celo mainnet
4. Save registration data locally
5. Provide next steps

## Security Checklist

Before deploying:

- [ ] `.env.local` is in `.gitignore`
- [ ] Private key is 66 characters (0x + 64 hex)
- [ ] Wallet has sufficient CELO (0.1+ recommended)
- [ ] Private key is stored in secure password manager
- [ ] No private keys in committed code
- [ ] No private keys in logs or console output

## Troubleshooting

### "AGENT_PRIVATE_KEY not properly configured"

The key must be:
- 66 characters total
- Starts with `0x`
- Followed by 64 hexadecimal characters (0-9, a-f, A-F)

Example format: `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

### "Insufficient funds"

Fund the wallet with CELO:
- **Mainnet**: Buy on exchange (Coinbase, Binance) and withdraw to wallet address
- **Testnet**: Use [Celo Faucet](https://faucet.celo.org/alfajores)

### "Transaction failed"

Common issues:
- Insufficient gas (need 0.01+ CELO)
- Network congestion (retry with higher gas)
- Invalid agentURI (must be accessible URL)

## Wallet Rotation

If you need to rotate to a new wallet:

1. Generate new wallet:
   ```bash
   node scripts/generate-agent-wallet.mjs
   ```

2. Update `.env.local` with new private key

3. Update `apps/web/config/chains.ts`:
   ```typescript
   export const AGENT_WALLET = "0x<new_address>" as Address;
   ```

4. Transfer any remaining funds from old wallet

5. Re-register on ERC-8004 with new wallet

## Production Deployment

For production:

1. Use environment variables (not .env files)
2. Consider using a secrets manager (AWS Secrets Manager, HashiCorp Vault)
3. Use separate wallets for different environments (dev/staging/prod)
4. Monitor wallet balance and set up alerts
5. Implement key rotation schedule

## References

- [ERC-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004)
- [8004scan Explorer](https://8004scan.io/)
- [Celo Documentation](https://docs.celo.org/)
- [Viem Documentation](https://viem.sh/)

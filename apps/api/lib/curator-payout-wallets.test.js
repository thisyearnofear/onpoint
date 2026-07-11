import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('curator-payout-wallets', () => {
  let tmpDir;
  let payoutWallets;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onpoint-payout-keys-'));
    process.env.CURATOR_PAYOUT_KEYS_PATH = path.join(tmpDir, 'keys.json');
    delete process.env.CURATOR_PAYOUT_KEYS_JSON;
    delete require.cache[require.resolve('./curator-payout-wallets')];
    payoutWallets = require('./curator-payout-wallets');
  });

  afterEach(() => {
    delete process.env.CURATOR_PAYOUT_KEYS_PATH;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates a custodial wallet per slug', () => {
    const first = payoutWallets.generateCustodialWallet('wanja');
    const second = payoutWallets.generateCustodialWallet('wanja');

    expect(first.alreadyExisted).toBe(false);
    expect(second.alreadyExisted).toBe(true);
    expect(first.address).toBe(second.address);
    expect(payoutWallets.isValidAddress(first.address)).toBe(true);
    expect(payoutWallets.hasCustodialWallet('wanja')).toBe(true);
  });

  it('builds commerce metadata for custodial wallets', () => {
    const commerce = payoutWallets.buildCommerceWithCustodialWallet(
      { checkout: 'whatsapp', splitAddress: '0x1111111111111111111111111111111111111111' },
      '0x2222222222222222222222222222222222222222',
    );

    expect(commerce.walletAddress).toBe('0x2222222222222222222222222222222222222222');
    expect(commerce.payoutWalletStatus).toBe('platform_custodial');
    expect(commerce.splitAddress).toBeUndefined();
  });

  it('builds commerce metadata for curator-owned wallets', () => {
    const commerce = payoutWallets.buildCommerceWithCuratorOwnedWallet(
      {
        checkout: 'whatsapp',
        payoutWalletStatus: 'platform_custodial',
        splitAddress: '0x1111111111111111111111111111111111111111',
      },
      '0x3333333333333333333333333333333333333333',
    );

    expect(commerce.payoutWalletStatus).toBe('curator_owned');
    expect(commerce.walletAddress).toBe('0x3333333333333333333333333333333333333333');
    expect(commerce.splitAddress).toBeUndefined();
  });
});

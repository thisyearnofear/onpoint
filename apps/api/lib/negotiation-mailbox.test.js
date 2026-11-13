import { beforeEach, describe, expect, it } from 'vitest';

const mailbox = require('./negotiation-mailbox');

const PAYEE = 'store.onpoint.testnet';
const CTX = { scope: 'order', curatorSlug: 'onpoint-store', listingId: 'l-1', size: 'M', quantity: 1, listCents: 1923, askCents: 1923, bundle: false, history: [] };

beforeEach(() => {
  mailbox._pending.clear();
});

describe('negotiation-mailbox', () => {
  it('enqueue + list by payee', () => {
    const a = mailbox.enqueue({ sessionId: 'neg_1', payee: PAYEE, round: 1, offer: { kind: 'offer', cents: 1700 }, context: CTX });
    mailbox.enqueue({ sessionId: 'neg_2', payee: 'curator.onpoint.testnet', round: 1, offer: { kind: 'offer', cents: 5 }, context: CTX });
    expect(a.pendingId).toMatch(/^pnx_/);
    const list = mailbox.list({ payee: PAYEE });
    expect(list).toHaveLength(1);
    expect(list[0].pendingId).toBe(a.pendingId);
    expect(list[0].round).toBe(1);
    expect(list[0].offer).toEqual({ kind: 'offer', cents: 1700 });
    expect(mailbox.list()).toHaveLength(2);
  });

  it('a newer offer supersedes the unanswered item of the same session', () => {
    const a = mailbox.enqueue({ sessionId: 'neg_1', payee: PAYEE, round: 1, offer: { kind: 'offer', cents: 1700 }, context: CTX });
    const b = mailbox.enqueue({ sessionId: 'neg_1', payee: PAYEE, round: 2, offer: { kind: 'offer', cents: 1800 }, context: CTX });
    expect(mailbox.get(a.pendingId).status).toBe('superseded');
    expect(mailbox.get(b.pendingId).status).toBe('pending');
    expect(mailbox.list({ payee: PAYEE })).toHaveLength(1);
  });

  it('items for other sessions stay pending', () => {
    mailbox.enqueue({ sessionId: 'neg_1', payee: PAYEE, round: 1, offer: { kind: 'offer', cents: 1700 }, context: CTX });
    const other = mailbox.enqueue({ sessionId: 'neg_2', payee: PAYEE, round: 1, offer: { kind: 'offer', cents: 100 }, context: CTX });
    mailbox.enqueue({ sessionId: 'neg_1', payee: PAYEE, round: 2, offer: { kind: 'offer', cents: 1800 }, context: CTX });
    expect(mailbox.get(other.pendingId).status).toBe('pending');
  });

  it('answer marks the item answered and keeps the response', () => {
    const a = mailbox.enqueue({ sessionId: 'neg_1', payee: PAYEE, round: 1, offer: { kind: 'offer', cents: 1700 }, context: CTX });
    mailbox.answer(a.pendingId, { decision: 'counter', price: 18 });
    const rec = mailbox.get(a.pendingId);
    expect(rec.status).toBe('answered');
    expect(rec.response).toEqual({ decision: 'counter', price: 18 });
  });

  it('cancel moves pending → given status, leaves answered alone', () => {
    const a = mailbox.enqueue({ sessionId: 'neg_1', payee: PAYEE, round: 1, offer: { kind: 'offer', cents: 1700 }, context: CTX });
    mailbox.cancel(a.pendingId, 'expired');
    expect(mailbox.get(a.pendingId).status).toBe('expired');
    const b = mailbox.enqueue({ sessionId: 'neg_3', payee: PAYEE, round: 1, offer: { kind: 'offer', cents: 1 }, context: CTX });
    mailbox.answer(b.pendingId, { decision: 'refuse' });
    mailbox.cancel(b.pendingId, 'expired');
    expect(mailbox.get(b.pendingId).status).toBe('answered');
  });

  it('an unanswered item expires after the TTL', () => {
    const now = 1_000_000;
    const a = mailbox.enqueue({ sessionId: 'neg_1', payee: PAYEE, round: 1, offer: { kind: 'offer', cents: 1700 }, context: CTX }, now);
    expect(mailbox.get(a.pendingId, now).status).toBe('pending');
    expect(mailbox.get(a.pendingId, now + mailbox.PENDING_TTL_MS).status).toBe('expired');
  });
});

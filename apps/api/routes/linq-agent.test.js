import { createRequire } from 'node:module';
import { afterAll, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

// Keep this unit test hermetic when a developer shell has live Linq
// credentials. The production client still uses live mode by default.
const previousLinqMock = process.env.LINQ_MOCK;
process.env.LINQ_MOCK = '1';
afterAll(() => {
  if (previousLinqMock === undefined) delete process.env.LINQ_MOCK;
  else process.env.LINQ_MOCK = previousLinqMock;
});

const { maskHandle, parseTrackCommand } = require('./linq-agent');
const linq = require('../lib/linq-client');

describe('Linq web mission handoff', () => {
  it('accepts only an explicit OnPoint order tracking command', () => {
    expect(
      parseTrackCommand('TRACK op_764de779-0755-4f91-b0e6-4c2411904d01'),
    ).toBe('op_764de779-0755-4f91-b0e6-4c2411904d01');
    expect(
      parseTrackCommand('buy op_764de779-0755-4f91-b0e6-4c2411904d01'),
    ).toBeNull();
    expect(parseTrackCommand('TRACK https://example.com')).toBeNull();
  });

  it('exposes only a masked recipient handle to the web handoff', () => {
    expect(maskHandle('+919876543210')).toBe('•••• 3210');
    expect(maskHandle('')).toBeNull();
  });
});

describe('Linq messaging safeguards', () => {
  it('matches documented exact opt-out keywords without substring false positives', () => {
    expect(linq.scanOptOut('STOP')).toBe(true);
    expect(linq.scanOptOut('stop')).toBe(false);
    expect(linq.scanOptOut('weekend jacket')).toBe(false);
    expect(linq.scanOptOut('please stop messaging me')).toBe(true);
  });

  it('treats opted-out and critical chats as terminal send gates', () => {
    expect(linq.canSendToChat({ health_status: { status: 'OPTED_OUT' } }).ok).toBe(false);
    expect(linq.canSendToChat({ reputation: 'CRITICAL' }).ok).toBe(false);
    expect(linq.canSendToChat({ health_status: { status: 'HEALTHY' } }).ok).toBe(true);
  });

  it('assigns an onboarding line and replies inside the inbound chat', async () => {
    const assignment = await linq.getAvailableNumber();
    expect(assignment.phone_number).toMatch(/^\+/);

    const sent = await linq.sendToChat({
      chatId: 'chat_judge_demo',
      text: 'Mission linked.',
      idempotencyKey: 'mission-link-test',
    });
    expect(sent.chatId).toBe('chat_judge_demo');
    expect(sent.messageId).toMatch(/^msg_mock_/);
  });
});

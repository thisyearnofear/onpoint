import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { classifyAgentCaller, recordAgentDemand } = require('./agent-demand');

describe('agent-demand', () => {
  const OWN = '0x5b33E63440e95289207120B94da78CE22F9D24fB';

  beforeEach(() => {
    process.env.AGENT_WALLET_ADDRESS = OWN;
  });

  it('classifies platform wallet as own', () => {
    expect(classifyAgentCaller(OWN)).toBe('own');
    expect(classifyAgentCaller(OWN.toLowerCase())).toBe('own');
  });

  it('classifies other payers as third_party', () => {
    expect(
      classifyAgentCaller('0x1111111111111111111111111111111111111111'),
    ).toBe('third_party');
  });

  it('treats missing payer as third_party', () => {
    expect(classifyAgentCaller(null)).toBe('third_party');
    expect(classifyAgentCaller(undefined)).toBe('third_party');
  });

  it('recordAgentDemand returns action key', () => {
    const result = recordAgentDemand('try_on', 'third_party', 'succeeded');
    expect(result.caller).toBe('third_party');
    expect(result.action).toBe('agent_try_on_third_party');
  });
});

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { parseTrackCommand } = require('./linq-agent');

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
});

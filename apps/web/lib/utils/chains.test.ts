import { 
  getAllChains, 
  getChainById, 
  getChainName, 
  getChainIcon, 
  getChainColor, 
  getChainFeatures,
  getSupportedChainsForDisplay 
} from './chains';

describe('Chain Utilities', () => {
  test('getAllChains returns all configured chains', () => {
    const chains = getAllChains();
    expect(chains.length).toBeGreaterThan(0);
    expect(Array.isArray(chains)).toBe(true);
  });

  test('getChainById returns correct chain', () => {
    const ethereum = getChainById(1);
    expect(ethereum).toBeDefined();
    expect(ethereum?.name).toBe('Ethereum');
    
    const lisk = getChainById(1135);
    expect(lisk).toBeDefined();
    expect(lisk?.name).toBe('Lisk');
  });

  test('getChainName returns correct names', () => {
    expect(getChainName(1)).toBe('Ethereum');
    expect(getChainName(1135)).toBe('Lisk');
    expect(getChainName(9999)).toBe('Unknown Network');
  });

  test('getChainIcon returns first letter of chain name', () => {
    expect(getChainName(1)).toBe('Ethereum');
    expect(getChainIcon(1)).toBe('E');
    expect(getChainIcon(1135)).toBe('L');
  });

  test('getChainColor returns consistent colors', () => {
    const color1 = getChainColor(1);
    const color2 = getChainColor(1);
    expect(color1).toBe(color2);
    expect(color1).toMatch(/^bg-\w+-\d+$/);
  });

  test('getChainFeatures returns descriptive features', () => {
    expect(getChainFeatures(1)).toContain('Ethereum');
    expect(getChainFeatures(1135)).toContain('Lisk');
    expect(getChainFeatures(9999)).toContain('Blockchain');
  });

  test('getSupportedChainsForDisplay filters and sorts chains', () => {
    const chains = getSupportedChainsForDisplay();
    expect(chains.length).toBeGreaterThan(0);
    
    // Check that chains are sorted alphabetically
    for (let i = 0; i < chains.length - 1; i++) {
      expect(chains[i].name.localeCompare(chains[i + 1].name)).toBeLessThanOrEqual(0);
    }
  });
});
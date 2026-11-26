import { describe, expect, it } from 'vitest';
import {
  calculateGrossScopeCommission,
  calculateNetCommission,
  ManualCommissionRequiredError,
  type WaterfallRates,
} from './commission.rules.js';

const rates: WaterfallRates = { vatRate: 0.18, hqOverheadRate: 0.1, partnerSplitRate: 0.5 };

describe('calculateNetCommission', () => {
  it('applies VAT, headquarters overhead, and the partner split', () => {
    expect(calculateNetCommission(14000, rates)).toBe(5338.98);
  });

  it('returns 0 when the gross amount is 0', () => {
    expect(calculateNetCommission(0, rates)).toBe(0);
  });
});

describe('calculateGrossScopeCommission', () => {
  it('calculates PER_MILLION as shekels per million of accumulation', () => {
    const gross = calculateGrossScopeCommission(2_000_000, {
      scopeRateType: 'PER_MILLION',
      scopeRateValue: 7000,
    });
    expect(gross).toBe(14000);
  });

  it('calculates PERCENT without an annual cap', () => {
    const gross = calculateGrossScopeCommission(100_000, {
      scopeRateType: 'PERCENT',
      scopeRateValue: 0.04,
      annualCap: null,
    });
    expect(gross).toBe(4000);
  });

  it('caps PERCENT at the annual cap', () => {
    const gross = calculateGrossScopeCommission(100_000, {
      scopeRateType: 'PERCENT',
      scopeRateValue: 0.04,
      annualCap: 2000,
    });
    expect(gross).toBe(2000);
  });

  it('leaves PERCENT unchanged when the result is under the cap', () => {
    const gross = calculateGrossScopeCommission(40_000, {
      scopeRateType: 'PERCENT',
      scopeRateValue: 0.04,
      annualCap: 2000,
    });
    expect(gross).toBe(1600);
  });

  it('returns the FIXED amount and ignores the base', () => {
    const gross = calculateGrossScopeCommission(999_999, {
      scopeRateType: 'FIXED',
      scopeRateValue: 500,
    });
    expect(gross).toBe(500);
  });

  it('requires a manual amount when the rule has no value', () => {
    expect(() =>
      calculateGrossScopeCommission(100_000, {
        scopeRateType: 'FIXED',
        scopeRateValue: null,
        requiresManualAmount: true,
      }),
    ).toThrow(ManualCommissionRequiredError);
  });

  it('uses the manual amount when one is provided', () => {
    const gross = calculateGrossScopeCommission(
      100_000,
      {
        scopeRateType: 'PER_MILLION',
        scopeRateValue: 3000,
        requiresManualAmount: true,
      },
      1500.456,
    );
    expect(gross).toBe(1500.46);
  });

  it('rejects a missing manual amount when the stored rate is null', () => {
    expect(() =>
      calculateGrossScopeCommission(100_000, {
        scopeRateType: 'FIXED',
        scopeRateValue: null,
      }),
    ).toThrow(/Manual commission amount is required/);
  });
});

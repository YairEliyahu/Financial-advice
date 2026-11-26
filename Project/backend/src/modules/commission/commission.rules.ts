export interface WaterfallRates {
  vatRate: number;
  hqOverheadRate: number;
  partnerSplitRate: number;
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function calculateNetCommission(grossAmount: number, rates: WaterfallRates): number {
  const afterVat = grossAmount / (1 + rates.vatRate);
  const afterHq = afterVat * (1 - rates.hqOverheadRate);
  const advisorShare = afterHq * rates.partnerSplitRate;
  return roundMoney(advisorShare);
}

export type ScopeRateType = 'FIXED' | 'PERCENT' | 'PER_MILLION';

export class ManualCommissionRequiredError extends Error {
  constructor() {
    super('Manual commission amount is required');
    this.name = 'ManualCommissionRequiredError';
  }
}

export interface ScopeRule {
  scopeRateType: ScopeRateType;
  scopeRateValue: number | null;
  annualCap?: number | null;
  requiresManualAmount?: boolean;
}

export function calculateGrossScopeCommission(
  baseAmount: number,
  rule: ScopeRule,
  manualAmount?: number,
): number {
  if (rule.requiresManualAmount || rule.scopeRateValue === null) {
    if (manualAmount === undefined || manualAmount < 0) {
      throw new ManualCommissionRequiredError();
    }
    return roundMoney(manualAmount);
  }

  let gross = 0;
  if (rule.scopeRateType === 'FIXED') {
    gross = rule.scopeRateValue;
  } else if (rule.scopeRateType === 'PERCENT') {
    gross = baseAmount * rule.scopeRateValue;
  } else {
    gross = (baseAmount / 1_000_000) * rule.scopeRateValue;
  }

  if (rule.annualCap != null) {
    gross = Math.min(gross, rule.annualCap);
  }

  return roundMoney(gross);
}

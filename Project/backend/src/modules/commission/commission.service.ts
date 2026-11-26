import {
  CALCULATION_BASE_LABELS,
  MANUFACTURER_TYPE_LABELS,
  PRODUCT_LABELS,
  type CalculationBase,
  type ManufacturerType,
  type ProductType,
} from './catalog.js';
import {
  calculateGrossScopeCommission,
  calculateNetCommission,
  roundMoney,
  type WaterfallRates,
} from './commission.rules.js';
import type { CommissionRuleRecord } from './rule.types.js';

export interface CommissionManufacturer {
  id: string;
  manufacturerType: ManufacturerType;
}

export interface CommissionInput {
  productType: ProductType;
  manufacturer: CommissionManufacturer;
  aumAmount: number;
  annualDeposits?: number;
  premium?: number;
  manualAmount?: number;
  rules: CommissionRuleRecord[];
  rates: WaterfallRates;
  agreementVersionId: string;
}

export interface CommissionQuote {
  grossScope: number;
  netScope: number;
  grossMonthlyOngoing: number;
  netMonthlyOngoing: number;
  annualPaceGross: number;
  annualPaceNet: number;
  agreementVersionId: string;
  ruleId: string;
  entersAum: boolean;
  requiresManualAmount: boolean;
  calculationBase: CalculationBase;
  calculationBaseLabel: string;
  showSeparateBase: boolean;
  showManualAmount: boolean;
  paymentFrequency: CommissionRuleRecord['paymentFrequency'];
  rule: CommissionRuleRecord;
}

export class ProductNotValidForManufacturerError extends Error {
  constructor() {
    super('PRODUCT_NOT_VALID');
    this.name = 'ProductNotValidForManufacturerError';
  }
}

export class CalculationBaseRequiredError extends Error {
  readonly calculationBase: CalculationBase;
  readonly requiresManualAmount: boolean;
  readonly entersAum: boolean;

  constructor(rule: CommissionRuleRecord) {
    super('CALCULATION_BASE_REQUIRED');
    this.name = 'CalculationBaseRequiredError';
    this.calculationBase = rule.calculationBase;
    this.requiresManualAmount = rule.requiresManualAmount;
    this.entersAum = rule.entersAum;
  }
}

export function matchCommissionRule(
  rules: CommissionRuleRecord[],
  productType: ProductType,
  manufacturer: CommissionManufacturer,
): CommissionRuleRecord {
  const specific = rules.filter(
    (rule) => rule.productType === productType && rule.manufacturerId === manufacturer.id,
  );
  if (specific.length > 1) {
    throw new Error('AMBIGUOUS_RULE');
  }
  const specificRule = specific[0];
  if (specificRule) {
    return specificRule;
  }

  const general = rules.filter(
    (rule) =>
      rule.productType === productType &&
      rule.manufacturerId == null &&
      rule.manufacturerType === manufacturer.manufacturerType,
  );
  if (general.length !== 1) {
    throw new ProductNotValidForManufacturerError();
  }
  const generalRule = general[0];
  if (!generalRule) {
    throw new ProductNotValidForManufacturerError();
  }
  return generalRule;
}

function selectBaseAmount(rule: CommissionRuleRecord, input: CommissionInput): number {
  if (rule.calculationBase === 'AUM') {
    return input.aumAmount;
  }
  if (rule.calculationBase === 'ANNUAL_DEPOSITS') {
    if (input.annualDeposits == null) {
      throw new CalculationBaseRequiredError(rule);
    }
    return input.annualDeposits;
  }
  if (input.premium == null) {
    throw new CalculationBaseRequiredError(rule);
  }
  return input.premium;
}

export function calculateDealCommission(input: CommissionInput): CommissionQuote {
  const rule = matchCommissionRule(input.rules, input.productType, input.manufacturer);
  const baseAmount = selectBaseAmount(rule, input);
  const grossScope = calculateGrossScopeCommission(
    baseAmount,
    {
      scopeRateType: rule.scopeRateType,
      scopeRateValue: rule.scopeRateValue,
      requiresManualAmount: rule.requiresManualAmount,
      annualCap: rule.ongoingRate > 0 ? null : rule.annualCap,
    },
    input.manualAmount,
  );

  let ongoingAnnual = 0;
  if (rule.ongoingRate > 0) {
    ongoingAnnual = roundMoney(baseAmount * rule.ongoingRate);
    if (rule.annualCap != null) {
      ongoingAnnual = Math.min(ongoingAnnual, rule.annualCap);
    }
  }

  const grossMonthlyOngoing = roundMoney(ongoingAnnual / 12);
  const netScope = calculateNetCommission(grossScope, input.rates);
  const netMonthlyOngoing = calculateNetCommission(grossMonthlyOngoing, input.rates);

  return {
    grossScope,
    netScope,
    grossMonthlyOngoing,
    netMonthlyOngoing,
    annualPaceGross: roundMoney(grossMonthlyOngoing * 12),
    annualPaceNet: roundMoney(netMonthlyOngoing * 12),
    agreementVersionId: input.agreementVersionId,
    ruleId: rule.id,
    entersAum: rule.entersAum,
    requiresManualAmount: rule.requiresManualAmount,
    calculationBase: rule.calculationBase,
    calculationBaseLabel: CALCULATION_BASE_LABELS[rule.calculationBase],
    showSeparateBase: rule.calculationBase !== 'AUM',
    showManualAmount: rule.requiresManualAmount,
    paymentFrequency: rule.paymentFrequency,
    rule,
  };
}

function formatShekels(amount: number): string {
  return new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 }).format(amount);
}

function formatPercent(rate: number): string {
  const percent = Math.round(rate * 10000) / 100;
  return `${percent}%`;
}

export function describeCommissionRule(rule: CommissionRuleRecord): string {
  if (rule.requiresManualAmount) {
    return 'אין נוסחה. חובה להזין סכום ידני, ואי אפשר לקלוט בלי סכום.';
  }

  const parts: string[] = [];
  const baseLabel = CALCULATION_BASE_LABELS[rule.calculationBase];
  if (rule.scopeRateValue != null && rule.scopeRateValue > 0) {
    if (rule.scopeRateType === 'PER_MILLION') {
      parts.push(`${formatShekels(rule.scopeRateValue)} ₪ למיליון ${baseLabel}`);
    } else if (rule.scopeRateType === 'PERCENT') {
      const cap =
        rule.annualCap != null && rule.ongoingRate === 0
          ? `, תקרה ${formatShekels(rule.annualCap)} ₪`
          : '';
      parts.push(`עמלת היקף ${formatPercent(rule.scopeRateValue)} מ${baseLabel}${cap}`);
    } else {
      parts.push(`עמלת היקף ${formatShekels(rule.scopeRateValue)} ₪ לעסקה`);
    }
  } else {
    parts.push('בלי עמלת היקף');
  }

  if (rule.ongoingRate > 0) {
    const cap = rule.annualCap != null ? `, תקרה ${formatShekels(rule.annualCap)} ₪ לשנה` : '';
    const cadence = rule.paymentFrequency === 'ANNUAL' ? ', תשלום שנתי' : '';
    parts.push(`נפרעים ${formatPercent(rule.ongoingRate)} מ${baseLabel}${cap}${cadence}`);
  }
  if (!rule.entersAum) {
    parts.push('לא נכנס לשווי התיק');
  }
  return parts.join(' · ');
}

export function ruleLabels(rule: CommissionRuleRecord): {
  productLabel: string;
  manufacturerTypeLabel: string;
} {
  return {
    productLabel: PRODUCT_LABELS[rule.productType],
    manufacturerTypeLabel: MANUFACTURER_TYPE_LABELS[rule.manufacturerType],
  };
}

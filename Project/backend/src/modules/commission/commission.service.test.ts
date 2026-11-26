import { describe, expect, it } from 'vitest';
import type { ManufacturerKey } from './catalog.js';
import {
  calculateDealCommission,
  CalculationBaseRequiredError,
  ProductNotValidForManufacturerError,
} from './commission.service.js';
import { calculateNetCommission, ManualCommissionRequiredError } from './commission.rules.js';
import { PILOT_RULE_DEFINITIONS } from './pilot.rules.js';
import type { CommissionRuleRecord } from './rule.types.js';

const manufacturers = {
  ALTSHULER: { id: 'alt', manufacturerType: 'INVESTMENT_HOUSE' as const },
  PHOENIX: { id: 'phx', manufacturerType: 'INSURANCE' as const },
  CLAL: { id: 'clal', manufacturerType: 'INSURANCE' as const },
  HACHSHARA: { id: 'hak', manufacturerType: 'INSURANCE' as const },
};

const ids: Record<ManufacturerKey, string> = {
  ALTSHULER: manufacturers.ALTSHULER.id,
  PHOENIX: manufacturers.PHOENIX.id,
  CLAL: manufacturers.CLAL.id,
  HACHSHARA: manufacturers.HACHSHARA.id,
};

const rules: CommissionRuleRecord[] = PILOT_RULE_DEFINITIONS.map((definition, index) => ({
  id: `rule-${index}`,
  productType: definition.productType,
  manufacturerType: definition.manufacturerType,
  manufacturerId: definition.manufacturerKey ? ids[definition.manufacturerKey] : null,
  scopeRateType: definition.scopeRateType,
  scopeRateValue: definition.scopeRateValue,
  annualCap: definition.annualCap,
  ongoingRate: definition.ongoingRate,
  calculationBase: definition.calculationBase,
  paymentFrequency: definition.paymentFrequency,
  entersAum: definition.entersAum,
  requiresManualAmount: definition.requiresManualAmount,
}));

const rates = { vatRate: 0.18, hqOverheadRate: 0.1, partnerSplitRate: 0.5 };
const agreementVersionId = 'version-1';

function quote(
  input: Omit<Parameters<typeof calculateDealCommission>[0], 'rules' | 'rates' | 'agreementVersionId'>,
) {
  return calculateDealCommission({ ...input, rules, rates, agreementVersionId });
}

describe('calculateDealCommission', () => {
  it('prefers a manufacturer exception over the general manufacturer-type rule', () => {
    const hachshara = quote({
      productType: 'SAVINGS',
      manufacturer: manufacturers.HACHSHARA,
      aumAmount: 1_000_000,
    });
    const clal = quote({
      productType: 'SAVINGS',
      manufacturer: manufacturers.CLAL,
      aumAmount: 1_000_000,
    });
    const exception = rules.find(
      (rule) => rule.productType === 'SAVINGS' && rule.manufacturerId === manufacturers.HACHSHARA.id,
    );
    const general = rules.find(
      (rule) => rule.productType === 'SAVINGS' && rule.manufacturerId == null,
    );

    expect(hachshara.grossScope).toBe(8000);
    expect(hachshara.netScope).toBe(calculateNetCommission(8000, rates));
    expect(hachshara.ruleId).toBe(exception?.id);
    expect(clal.grossScope).toBe(10000);
    expect(clal.ruleId).toBe(general?.id);
  });

  it('blocks a product that is not valid for the manufacturer', () => {
    expect(() =>
      quote({
        productType: 'SAVINGS',
        manufacturer: manufacturers.ALTSHULER,
        aumAmount: 1_000_000,
      }),
    ).toThrow(ProductNotValidForManufacturerError);

    expect(() =>
      quote({
        productType: 'INVESTMENT_PROVIDENT_ONGOING',
        manufacturer: manufacturers.CLAL,
        aumAmount: 100_000,
        annualDeposits: 100_000,
      }),
    ).toThrow(ProductNotValidForManufacturerError);
  });

  it('uses AUM for scope commission and ignores a separate deposits figure', () => {
    const result = quote({
      productType: 'STUDY_FUND',
      manufacturer: manufacturers.ALTSHULER,
      aumAmount: 2_000_000,
      annualDeposits: 50_000,
      premium: 80_000,
    });

    expect(result.grossScope).toBe(14000);
    expect(result.netScope).toBe(5338.98);
    expect(result.grossMonthlyOngoing).toBe(0);
    expect(result.netMonthlyOngoing).toBe(0);
    expect(result.annualPaceGross).toBe(0);
    expect(result.annualPaceNet).toBe(0);
    expect(result.calculationBase).toBe('AUM');
    expect(result.showSeparateBase).toBe(false);
    expect(result.entersAum).toBe(true);
    expect(result.agreementVersionId).toBe(agreementVersionId);
  });

  it('uses annual deposits for ongoing commission and not the portfolio amount', () => {
    const result = quote({
      productType: 'PENSION_ONGOING',
      manufacturer: manufacturers.ALTSHULER,
      aumAmount: 2_000_000,
      annualDeposits: 120_000,
    });

    expect(result.calculationBase).toBe('ANNUAL_DEPOSITS');
    expect(result.showSeparateBase).toBe(true);
    expect(result.grossScope).toBe(0);
    expect(result.grossMonthlyOngoing).toBe(700);
    expect(result.netMonthlyOngoing).toBe(266.95);
    expect(result.annualPaceGross).toBe(8400);
    expect(result.annualPaceNet).toBe(3203.4);
  });

  it('uses premium for risk and keeps the amount out of AUM', () => {
    expect(() =>
      quote({
        productType: 'RISK',
        manufacturer: manufacturers.ALTSHULER,
        aumAmount: 5_000_000,
      }),
    ).toThrow(CalculationBaseRequiredError);

    const result = quote({
      productType: 'RISK',
      manufacturer: manufacturers.ALTSHULER,
      aumAmount: 5_000_000,
      premium: 10_000,
    });

    expect(result.calculationBase).toBe('PREMIUM');
    expect(result.grossScope).toBe(8000);
    expect(result.netScope).toBe(calculateNetCommission(8000, rates));
    expect(result.entersAum).toBe(false);
    expect(result.grossMonthlyOngoing).toBe(0);
  });

  it('caps the annual ongoing fee and derives monthly ongoing and annual pace from it', () => {
    const result = quote({
      productType: 'SAVINGS_ONGOING',
      manufacturer: manufacturers.HACHSHARA,
      aumAmount: 400_000,
      annualDeposits: 100_000,
    });

    expect(result.grossScope).toBe(0);
    expect(result.netScope).toBe(0);
    expect(result.grossMonthlyOngoing).toBe(166.67);
    expect(result.netMonthlyOngoing).toBe(63.56);
    expect(result.annualPaceGross).toBe(2000.04);
    expect(result.annualPaceNet).toBe(762.72);
  });

  it('lets a manual manufacturer exception replace the general per-million rate', () => {
    expect(() =>
      quote({
        productType: 'PENSION_TRANSFER',
        manufacturer: manufacturers.PHOENIX,
        aumAmount: 1_000_000,
      }),
    ).toThrow(ManualCommissionRequiredError);

    const manual = quote({
      productType: 'PENSION_TRANSFER',
      manufacturer: manufacturers.PHOENIX,
      aumAmount: 1_000_000,
      manualAmount: 4000,
    });
    const general = quote({
      productType: 'PENSION_TRANSFER',
      manufacturer: manufacturers.ALTSHULER,
      aumAmount: 1_000_000,
    });

    expect(manual.grossScope).toBe(4000);
    expect(manual.netScope).toBe(calculateNetCommission(4000, rates));
    expect(manual.showManualAmount).toBe(true);
    expect(general.grossScope).toBe(3000);
    expect(general.showManualAmount).toBe(false);
  });

  it('applies an annual cap to scope commission when the rule has no ongoing rate', () => {
    const result = calculateDealCommission({
      productType: 'SAVINGS',
      manufacturer: manufacturers.CLAL,
      aumAmount: 100_000,
      rules: [
        {
          id: 'capped-percent',
          productType: 'SAVINGS',
          manufacturerType: 'INSURANCE',
          manufacturerId: null,
          scopeRateType: 'PERCENT',
          scopeRateValue: 0.04,
          annualCap: 2000,
          ongoingRate: 0,
          calculationBase: 'AUM',
          paymentFrequency: 'ONE_TIME',
          entersAum: true,
          requiresManualAmount: false,
        },
      ],
      rates,
      agreementVersionId,
    });

    expect(result.grossScope).toBe(2000);
    expect(result.netScope).toBe(762.71);
    expect(result.grossMonthlyOngoing).toBe(0);
    expect(result.annualPaceGross).toBe(0);
  });
});

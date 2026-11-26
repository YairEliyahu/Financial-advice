import { DomainError } from '../../domain/errors.js';
import { withTenantTransaction, type Db } from '../../db/transaction.js';
import * as agreementsModel from '../agreements/agreements.model.js';
import { CALCULATION_BASE_LABELS, PRODUCT_LABELS, type ProductType } from '../commission/catalog.js';
import {
  calculateDealCommission,
  CalculationBaseRequiredError,
  matchCommissionRule,
  type CommissionQuote,
} from '../commission/commission.service.js';
import { ManualCommissionRequiredError, type WaterfallRates } from '../commission/commission.rules.js';
import * as clientsModel from '../clients/clients.model.js';
import { jerusalemToday } from '../dashboard/dates.js';
import * as manufacturersModel from '../manufacturers/manufacturers.model.js';
import * as dealsModel from './deals.model.js';

export interface QuoteRequest {
  productType: ProductType;
  manufacturerId: string;
  dealDate: string;
  aumAmount: number;
  calculationBaseAmount?: number;
  manualAmount?: number;
}

export interface PreviewResult {
  ready: boolean;
  message: string | null;
  showSeparateBase: boolean;
  showManualAmount: boolean;
  calculationBaseLabel: string | null;
  entersAum: boolean;
  grossScope: number | null;
  netScope: number | null;
  grossMonthlyOngoing: number | null;
  netMonthlyOngoing: number | null;
  annualPaceGross: number | null;
  annualPaceNet: number | null;
}

const STATUS_LABELS: Record<dealsModel.DealStatus, string> = {
  SUBMITTED: 'נרשמה',
  ABSORBED: 'נקלטה',
  CHURNED: 'נטישה',
};

const RECONCILIATION_LABELS: Record<dealsModel.ReconciliationStatus, string> = {
  PENDING_INTAKE: 'ממתין לקליטה',
  PENDING_REVIEW: 'ממתין לאימות',
  MATCHED: 'תואם',
  DISCREPANCY: 'פער',
};

function presentDeal(deal: dealsModel.DealRecord) {
  return {
    ...deal,
    productLabel: PRODUCT_LABELS[deal.productType],
    calculationBaseLabel: deal.calculationBase ? CALCULATION_BASE_LABELS[deal.calculationBase] : null,
    dealStatusLabel: STATUS_LABELS[deal.dealStatus],
    reconciliationStatusLabel: RECONCILIATION_LABELS[deal.reconciliationStatus],
  };
}

function sortDeals(deals: dealsModel.DealRecord[]): dealsModel.DealRecord[] {
  return [...deals].sort((left, right) => {
    if (left.reconciliationStatus === 'DISCREPANCY' && right.reconciliationStatus !== 'DISCREPANCY') {
      return -1;
    }
    if (right.reconciliationStatus === 'DISCREPANCY' && left.reconciliationStatus !== 'DISCREPANCY') {
      return 1;
    }
    return right.dealDate.localeCompare(left.dealDate);
  });
}

async function quoteOn(db: Db, request: QuoteRequest): Promise<CommissionQuote> {
  const manufacturer = await manufacturersModel.findManufacturer(db, request.manufacturerId);
  if (!manufacturer) {
    throw new DomainError('MANUFACTURER_NOT_FOUND');
  }
  const version = await agreementsModel.findVersionForDate(db, request.dealDate);
  if (!version) {
    throw new DomainError('NO_AGREEMENT');
  }
  const rules = await agreementsModel.listRules(db, version.id);
  const rates: WaterfallRates = {
    vatRate: version.vatRate,
    hqOverheadRate: version.hqOverheadRate,
    partnerSplitRate: version.partnerSplitRate,
  };
  return calculateDealCommission({
    productType: request.productType,
    manufacturer,
    aumAmount: request.aumAmount,
    rules,
    rates,
    agreementVersionId: version.id,
    ...(request.calculationBaseAmount != null
      ? { annualDeposits: request.calculationBaseAmount, premium: request.calculationBaseAmount }
      : {}),
    ...(request.manualAmount != null ? { manualAmount: request.manualAmount } : {}),
  });
}

function snapshot(quote: CommissionQuote, rates: WaterfallRates) {
  return {
    ruleId: quote.ruleId,
    agreementVersionId: quote.agreementVersionId,
    rule: quote.rule,
    rates,
    grossScope: quote.grossScope,
    netScope: quote.netScope,
    grossMonthlyOngoing: quote.grossMonthlyOngoing,
    netMonthlyOngoing: quote.netMonthlyOngoing,
    annualPaceGross: quote.annualPaceGross,
    annualPaceNet: quote.annualPaceNet,
  };
}

function emptyPreview(message: string, showSeparateBase: boolean, showManualAmount: boolean, label: string | null, entersAum: boolean): PreviewResult {
  return {
    ready: false,
    message,
    showSeparateBase,
    showManualAmount,
    calculationBaseLabel: label,
    entersAum,
    grossScope: null,
    netScope: null,
    grossMonthlyOngoing: null,
    netMonthlyOngoing: null,
    annualPaceGross: null,
    annualPaceNet: null,
  };
}

function previewFromQuote(quote: CommissionQuote): PreviewResult {
  return {
    ready: true,
    message: null,
    showSeparateBase: quote.showSeparateBase,
    showManualAmount: quote.showManualAmount,
    calculationBaseLabel: quote.calculationBaseLabel,
    entersAum: quote.entersAum,
    grossScope: quote.grossScope,
    netScope: quote.netScope,
    grossMonthlyOngoing: quote.grossMonthlyOngoing,
    netMonthlyOngoing: quote.netMonthlyOngoing,
    annualPaceGross: quote.annualPaceGross,
    annualPaceNet: quote.annualPaceNet,
  };
}

export async function preview(tenantId: string, request: QuoteRequest): Promise<PreviewResult> {
  return withTenantTransaction(tenantId, async (db) => {
    const manufacturer = await manufacturersModel.findManufacturer(db, request.manufacturerId);
    if (!manufacturer) {
      throw new DomainError('MANUFACTURER_NOT_FOUND');
    }
    const version = await agreementsModel.findVersionForDate(db, request.dealDate);
    if (!version) {
      throw new DomainError('NO_AGREEMENT');
    }
    const rules = await agreementsModel.listRules(db, version.id);
    const rule = matchCommissionRule(rules, request.productType, manufacturer);
    try {
      return previewFromQuote(await quoteOn(db, request));
    } catch (error) {
      if (error instanceof CalculationBaseRequiredError || error instanceof ManualCommissionRequiredError) {
        return emptyPreview(
          error instanceof ManualCommissionRequiredError ? 'חובה להזין סכום עמלה ידני' : 'צריך להזין את בסיס החישוב',
          rule.calculationBase !== 'AUM',
          rule.requiresManualAmount,
          CALCULATION_BASE_LABELS[rule.calculationBase],
          rule.entersAum,
        );
      }
      throw error;
    }
  });
}

export async function listDeals(tenantId: string) {
  const deals = await withTenantTransaction(tenantId, (db) => dealsModel.listDeals(db));
  return sortDeals(deals).map(presentDeal);
}

export async function createDeal(
  tenantId: string,
  input: QuoteRequest & { clientId: string },
) {
  return withTenantTransaction(tenantId, async (db) => {
    const client = await clientsModel.findClient(db, input.clientId);
    if (!client) {
      throw new DomainError('CLIENT_NOT_FOUND');
    }
    const quote = await quoteOn(db, input);
    const version = await agreementsModel.findVersionForDate(db, input.dealDate);
    if (!version) {
      throw new DomainError('NO_AGREEMENT');
    }
    const deal = await dealsModel.insertDeal(db, {
      tenantId,
      clientId: input.clientId,
      manufacturerId: input.manufacturerId,
      productType: input.productType,
      dealDate: input.dealDate,
      expectedAmount: input.aumAmount,
      calculationBaseAmount: input.calculationBaseAmount ?? null,
      manualAmount: input.manualAmount ?? null,
      expectedGrossScope: quote.grossScope,
      expectedNetScope: quote.netScope,
      expectedGrossMonthlyOngoing: quote.grossMonthlyOngoing,
      expectedNetMonthlyOngoing: quote.netMonthlyOngoing,
      expectedAnnualPaceGross: quote.annualPaceGross,
      expectedAnnualPaceNet: quote.annualPaceNet,
      entersAum: quote.entersAum,
      showSeparateBase: quote.showSeparateBase,
      requiresManualAmount: quote.requiresManualAmount,
      calculationBase: quote.calculationBase,
      agreementVersionId: quote.agreementVersionId,
      ruleSnapshot: snapshot(quote, {
        vatRate: version.vatRate,
        hqOverheadRate: version.hqOverheadRate,
        partnerSplitRate: version.partnerSplitRate,
      }),
    });
    return presentDeal(deal);
  });
}

export async function absorbDeal(
  tenantId: string,
  dealId: string,
  input: { actualAmount: number; calculationBaseAmount?: number; manualAmount?: number },
) {
  return withTenantTransaction(tenantId, async (db) => {
    const existing = await dealsModel.findDealForUpdate(db, dealId);
    if (!existing) {
      throw new DomainError('DEAL_NOT_FOUND');
    }
    if (existing.dealStatus !== 'SUBMITTED') {
      throw new DomainError('ALREADY_ABSORBED');
    }
    const absorbedOn = jerusalemToday();
    const calculationBaseAmount = input.calculationBaseAmount ?? existing.calculationBaseAmount ?? undefined;
    const manualAmount = input.manualAmount ?? existing.manualAmount ?? undefined;
    const quote = await quoteOn(db, {
      productType: existing.productType,
      manufacturerId: existing.manufacturerId,
      dealDate: absorbedOn,
      aumAmount: input.actualAmount,
      ...(calculationBaseAmount != null ? { calculationBaseAmount } : {}),
      ...(manualAmount != null ? { manualAmount } : {}),
    });
    const version = await agreementsModel.findVersionForDate(db, absorbedOn);
    if (!version) {
      throw new DomainError('NO_AGREEMENT');
    }
    const deal = await dealsModel.markAbsorbed(db, {
      dealId,
      absorbedOn,
      actualAmount: input.actualAmount,
      calculationBaseAmount: calculationBaseAmount ?? null,
      manualAmount: manualAmount ?? null,
      recognizedGrossScope: quote.grossScope,
      recognizedNetScope: quote.netScope,
      recognizedGrossMonthlyOngoing: quote.grossMonthlyOngoing,
      recognizedNetMonthlyOngoing: quote.netMonthlyOngoing,
      recognizedAnnualPaceGross: quote.annualPaceGross,
      recognizedAnnualPaceNet: quote.annualPaceNet,
      entersAum: quote.entersAum,
      showSeparateBase: quote.showSeparateBase,
      requiresManualAmount: quote.requiresManualAmount,
      calculationBase: quote.calculationBase,
      agreementVersionId: quote.agreementVersionId,
      ruleSnapshot: snapshot(quote, {
        vatRate: version.vatRate,
        hqOverheadRate: version.hqOverheadRate,
        partnerSplitRate: version.partnerSplitRate,
      }),
    });
    return presentDeal(deal);
  });
}

export interface DealPatch {
  clientId?: string;
  manufacturerId?: string;
  productType?: ProductType;
  dealDate?: string;
  expectedAmount?: number;
  calculationBaseAmount?: number | null;
  manualAmount?: number | null;
  reconciliationStatus?: 'PENDING_REVIEW' | 'MATCHED' | 'DISCREPANCY';
  note?: string | null;
  actualAmount?: number;
}

function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

export async function updateDeal(tenantId: string, dealId: string, input: DealPatch) {
  return withTenantTransaction(tenantId, async (db) => {
    const existing = await dealsModel.findDealForUpdate(db, dealId);
    if (!existing) {
      throw new DomainError('DEAL_NOT_FOUND');
    }
    if (existing.dealStatus === 'CHURNED') {
      throw new DomainError('LOCKED');
    }

    const note = hasOwn(input, 'note') ? (input.note ?? null) : existing.note;

    if (existing.dealStatus === 'SUBMITTED') {
      if (input.reconciliationStatus != null || input.actualAmount != null) {
        throw new DomainError('NOT_ABSORBED');
      }
      const financial =
        input.manufacturerId != null ||
        input.productType != null ||
        input.dealDate != null ||
        input.expectedAmount != null ||
        hasOwn(input, 'calculationBaseAmount') ||
        hasOwn(input, 'manualAmount');
      const clientId = input.clientId ?? existing.clientId;
      if (input.clientId != null) {
        const client = await clientsModel.findClient(db, input.clientId);
        if (!client) {
          throw new DomainError('CLIENT_NOT_FOUND');
        }
      }
      if (!financial) {
        const deal = await dealsModel.updateSubmittedIdentity(db, dealId, clientId, note);
        return presentDeal(deal);
      }
      const manufacturerId = input.manufacturerId ?? existing.manufacturerId;
      const productType = input.productType ?? existing.productType;
      const dealDate = input.dealDate ?? existing.dealDate;
      const expectedAmount = input.expectedAmount ?? existing.expectedAmount;
      const calculationBaseAmount = hasOwn(input, 'calculationBaseAmount')
        ? (input.calculationBaseAmount ?? null)
        : existing.calculationBaseAmount;
      const manualAmount = hasOwn(input, 'manualAmount') ? (input.manualAmount ?? null) : existing.manualAmount;
      const quote = await quoteOn(db, {
        productType,
        manufacturerId,
        dealDate,
        aumAmount: expectedAmount,
        ...(calculationBaseAmount != null ? { calculationBaseAmount } : {}),
        ...(manualAmount != null ? { manualAmount } : {}),
      });
      const version = await agreementsModel.findVersionForDate(db, dealDate);
      if (!version) {
        throw new DomainError('NO_AGREEMENT');
      }
      const deal = await dealsModel.updateSubmittedDeal(db, {
        dealId,
        clientId,
        manufacturerId,
        productType,
        dealDate,
        expectedAmount,
        calculationBaseAmount,
        manualAmount,
        expectedGrossScope: quote.grossScope,
        expectedNetScope: quote.netScope,
        expectedGrossMonthlyOngoing: quote.grossMonthlyOngoing,
        expectedNetMonthlyOngoing: quote.netMonthlyOngoing,
        expectedAnnualPaceGross: quote.annualPaceGross,
        expectedAnnualPaceNet: quote.annualPaceNet,
        entersAum: quote.entersAum,
        showSeparateBase: quote.showSeparateBase,
        requiresManualAmount: quote.requiresManualAmount,
        calculationBase: quote.calculationBase,
        agreementVersionId: quote.agreementVersionId,
        ruleSnapshot: snapshot(quote, {
          vatRate: version.vatRate,
          hqOverheadRate: version.hqOverheadRate,
          partnerSplitRate: version.partnerSplitRate,
        }),
        note,
      });
      return presentDeal(deal);
    }

    if (
      input.clientId != null ||
      input.manufacturerId != null ||
      input.productType != null ||
      input.dealDate != null ||
      input.expectedAmount != null
    ) {
      throw new DomainError('ALREADY_ABSORBED');
    }

    const touchesSnapshot =
      input.actualAmount != null || hasOwn(input, 'calculationBaseAmount') || hasOwn(input, 'manualAmount');
    if (touchesSnapshot) {
      if (existing.reconciliationStatus === 'MATCHED') {
        throw new DomainError('LOCKED');
      }
      if (!existing.absorbedOn) {
        throw new DomainError('NOT_READY');
      }
      const actualAmount = input.actualAmount ?? existing.actualAmount;
      if (actualAmount == null) {
        throw new DomainError('NOT_READY');
      }
      const calculationBaseAmount = hasOwn(input, 'calculationBaseAmount')
        ? (input.calculationBaseAmount ?? null)
        : existing.calculationBaseAmount;
      const manualAmount = hasOwn(input, 'manualAmount') ? (input.manualAmount ?? null) : existing.manualAmount;
      const quote = await quoteOn(db, {
        productType: existing.productType,
        manufacturerId: existing.manufacturerId,
        dealDate: existing.absorbedOn,
        aumAmount: actualAmount,
        ...(calculationBaseAmount != null ? { calculationBaseAmount } : {}),
        ...(manualAmount != null ? { manualAmount } : {}),
      });
      const version = await agreementsModel.findVersionForDate(db, existing.absorbedOn);
      if (!version) {
        throw new DomainError('NO_AGREEMENT');
      }
      await dealsModel.correctAbsorbedSnapshot(db, {
        dealId,
        actualAmount,
        calculationBaseAmount,
        manualAmount,
        recognizedGrossScope: quote.grossScope,
        recognizedNetScope: quote.netScope,
        recognizedGrossMonthlyOngoing: quote.grossMonthlyOngoing,
        recognizedNetMonthlyOngoing: quote.netMonthlyOngoing,
        recognizedAnnualPaceGross: quote.annualPaceGross,
        recognizedAnnualPaceNet: quote.annualPaceNet,
        entersAum: quote.entersAum,
        showSeparateBase: quote.showSeparateBase,
        requiresManualAmount: quote.requiresManualAmount,
        calculationBase: quote.calculationBase,
        agreementVersionId: quote.agreementVersionId,
        ruleSnapshot: snapshot(quote, {
          vatRate: version.vatRate,
          hqOverheadRate: version.hqOverheadRate,
          partnerSplitRate: version.partnerSplitRate,
        }),
      });
    }

    const nextStatus = input.reconciliationStatus ?? existing.reconciliationStatus;
    if (nextStatus === 'PENDING_INTAKE') {
      throw new DomainError('NOT_READY');
    }
    if (nextStatus === 'DISCREPANCY' && (note ?? '').trim().length === 0) {
      throw new DomainError('NOTE_REQUIRED');
    }
    if (input.reconciliationStatus != null || hasOwn(input, 'note')) {
      const deal = await dealsModel.updateReconciliation(db, dealId, nextStatus, note);
      return presentDeal(deal);
    }
    const deal = await dealsModel.findDealForUpdate(db, dealId);
    if (!deal) {
      throw new DomainError('DEAL_NOT_FOUND');
    }
    return presentDeal(deal);
  });
}

export async function reconcileDeal(
  tenantId: string,
  dealId: string,
  input: { status: 'MATCHED' | 'DISCREPANCY'; note: string | null },
) {
  return withTenantTransaction(tenantId, async (db) => {
    const existing = await dealsModel.findDealForUpdate(db, dealId);
    if (!existing) {
      throw new DomainError('DEAL_NOT_FOUND');
    }
    if (existing.reconciliationStatus === 'MATCHED') {
      throw new DomainError('LOCKED');
    }
    if (existing.reconciliationStatus === 'PENDING_INTAKE' || existing.dealStatus !== 'ABSORBED') {
      throw new DomainError('NOT_READY');
    }
    const note = input.status === 'DISCREPANCY' ? input.note : existing.note;
    const deal = await dealsModel.updateReconciliation(db, dealId, input.status, note);
    return presentDeal(deal);
  });
}

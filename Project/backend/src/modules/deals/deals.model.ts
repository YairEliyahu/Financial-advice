import { asDateString, asNullableDateString, toNullableNumber, toNumber } from '../../db/numbers.js';
import { queryRows, type Db } from '../../db/transaction.js';
import {
  isCalculationBase,
  isProductType,
  type CalculationBase,
  type ProductType,
} from '../commission/catalog.js';

export type DealStatus = 'SUBMITTED' | 'ABSORBED' | 'CHURNED';
export type ReconciliationStatus = 'PENDING_INTAKE' | 'PENDING_REVIEW' | 'MATCHED' | 'DISCREPANCY';

export interface DealRecord {
  id: string;
  clientId: string;
  clientName: string;
  isBasePortfolio: boolean;
  manufacturerId: string;
  manufacturerName: string;
  productType: ProductType;
  dealDate: string;
  absorbedOn: string | null;
  expectedAmount: number;
  actualAmount: number | null;
  calculationBaseAmount: number | null;
  manualAmount: number | null;
  expectedGrossScope: number | null;
  expectedNetScope: number | null;
  expectedGrossMonthlyOngoing: number | null;
  expectedNetMonthlyOngoing: number | null;
  expectedAnnualPaceGross: number | null;
  expectedAnnualPaceNet: number | null;
  recognizedGrossScope: number | null;
  recognizedNetScope: number | null;
  recognizedGrossMonthlyOngoing: number | null;
  recognizedNetMonthlyOngoing: number | null;
  recognizedAnnualPaceGross: number | null;
  recognizedAnnualPaceNet: number | null;
  entersAum: boolean;
  showSeparateBase: boolean;
  requiresManualAmount: boolean;
  calculationBase: CalculationBase | null;
  agreementVersionId: string | null;
  dealStatus: DealStatus;
  reconciliationStatus: ReconciliationStatus;
  note: string | null;
}

interface DealRow {
  id: string;
  client_id: string;
  client_name: string;
  is_base_portfolio: boolean;
  manufacturer_id: string;
  manufacturer_name: string;
  product_type: string;
  deal_date: string;
  absorbed_on: string | null;
  expected_amount: string;
  actual_amount: string | null;
  calculation_base_amount: string | null;
  manual_amount: string | null;
  expected_gross_scope: string | null;
  expected_net_scope: string | null;
  expected_gross_monthly_ongoing: string | null;
  expected_net_monthly_ongoing: string | null;
  expected_annual_pace_gross: string | null;
  expected_annual_pace_net: string | null;
  recognized_gross_scope: string | null;
  recognized_net_scope: string | null;
  recognized_gross_monthly_ongoing: string | null;
  recognized_net_monthly_ongoing: string | null;
  recognized_annual_pace_gross: string | null;
  recognized_annual_pace_net: string | null;
  enters_aum: boolean;
  show_separate_base: boolean;
  requires_manual_amount: boolean;
  calculation_base: string | null;
  agreement_version_id: string | null;
  deal_status: DealStatus;
  reconciliation_status: ReconciliationStatus;
  note: string | null;
}

const DEAL_SELECT = `
  SELECT d.id, d.client_id, c.full_name AS client_name, c.is_base_portfolio,
         d.manufacturer_id, m.name_he AS manufacturer_name, d.product_type,
         d.deal_date, d.absorbed_on, d.expected_amount, d.actual_amount,
         d.calculation_base_amount, d.manual_amount,
         d.expected_gross_scope, d.expected_net_scope,
         d.expected_gross_monthly_ongoing, d.expected_net_monthly_ongoing,
         d.expected_annual_pace_gross, d.expected_annual_pace_net,
         d.recognized_gross_scope, d.recognized_net_scope,
         d.recognized_gross_monthly_ongoing, d.recognized_net_monthly_ongoing,
         d.recognized_annual_pace_gross, d.recognized_annual_pace_net,
         d.enters_aum, d.show_separate_base, d.requires_manual_amount, d.calculation_base,
         d.agreement_version_id, d.deal_status, d.reconciliation_status, d.note
  FROM deals d
  JOIN clients c ON c.id = d.client_id
  JOIN manufacturers m ON m.id = d.manufacturer_id
`;

function mapDeal(row: DealRow): DealRecord {
  if (!isProductType(row.product_type)) {
    throw new Error('UNKNOWN_PRODUCT');
  }
  if (row.calculation_base != null && !isCalculationBase(row.calculation_base)) {
    throw new Error('UNKNOWN_BASE');
  }
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    isBasePortfolio: row.is_base_portfolio,
    manufacturerId: row.manufacturer_id,
    manufacturerName: row.manufacturer_name,
    productType: row.product_type,
    dealDate: asDateString(row.deal_date),
    absorbedOn: asNullableDateString(row.absorbed_on),
    expectedAmount: toNumber(row.expected_amount),
    actualAmount: toNullableNumber(row.actual_amount),
    calculationBaseAmount: toNullableNumber(row.calculation_base_amount),
    manualAmount: toNullableNumber(row.manual_amount),
    expectedGrossScope: toNullableNumber(row.expected_gross_scope),
    expectedNetScope: toNullableNumber(row.expected_net_scope),
    expectedGrossMonthlyOngoing: toNullableNumber(row.expected_gross_monthly_ongoing),
    expectedNetMonthlyOngoing: toNullableNumber(row.expected_net_monthly_ongoing),
    expectedAnnualPaceGross: toNullableNumber(row.expected_annual_pace_gross),
    expectedAnnualPaceNet: toNullableNumber(row.expected_annual_pace_net),
    recognizedGrossScope: toNullableNumber(row.recognized_gross_scope),
    recognizedNetScope: toNullableNumber(row.recognized_net_scope),
    recognizedGrossMonthlyOngoing: toNullableNumber(row.recognized_gross_monthly_ongoing),
    recognizedNetMonthlyOngoing: toNullableNumber(row.recognized_net_monthly_ongoing),
    recognizedAnnualPaceGross: toNullableNumber(row.recognized_annual_pace_gross),
    recognizedAnnualPaceNet: toNullableNumber(row.recognized_annual_pace_net),
    entersAum: row.enters_aum,
    showSeparateBase: row.show_separate_base,
    requiresManualAmount: row.requires_manual_amount,
    calculationBase: row.calculation_base,
    agreementVersionId: row.agreement_version_id,
    dealStatus: row.deal_status,
    reconciliationStatus: row.reconciliation_status,
    note: row.note,
  };
}

export async function listDeals(db: Db): Promise<DealRecord[]> {
  const rows = await queryRows<DealRow>(db, `${DEAL_SELECT} ORDER BY d.deal_date DESC, d.created_at DESC`);
  return rows.map(mapDeal);
}

export async function findDealForUpdate(db: Db, dealId: string): Promise<DealRecord | null> {
  const rows = await queryRows<DealRow>(db, `${DEAL_SELECT} WHERE d.id = $1 FOR UPDATE OF d`, [dealId]);
  const row = rows[0];
  return row ? mapDeal(row) : null;
}

export interface NewDealInput {
  tenantId: string;
  clientId: string;
  manufacturerId: string;
  productType: ProductType;
  dealDate: string;
  expectedAmount: number;
  calculationBaseAmount: number | null;
  manualAmount: number | null;
  expectedGrossScope: number;
  expectedNetScope: number;
  expectedGrossMonthlyOngoing: number;
  expectedNetMonthlyOngoing: number;
  expectedAnnualPaceGross: number;
  expectedAnnualPaceNet: number;
  entersAum: boolean;
  showSeparateBase: boolean;
  requiresManualAmount: boolean;
  calculationBase: CalculationBase;
  agreementVersionId: string;
  ruleSnapshot: unknown;
}

export async function insertDeal(db: Db, input: NewDealInput): Promise<DealRecord> {
  const rows = await queryRows<{ id: string }>(
    db,
    `INSERT INTO deals (
       tenant_id, client_id, manufacturer_id, product_type, deal_date, expected_amount,
       calculation_base_amount, manual_amount,
       expected_gross_scope, expected_net_scope, expected_gross_monthly_ongoing,
       expected_net_monthly_ongoing, expected_annual_pace_gross, expected_annual_pace_net,
       enters_aum, show_separate_base, requires_manual_amount, calculation_base,
       agreement_version_id, rule_snapshot, deal_status, reconciliation_status
     ) VALUES (
       $1, $2, $3, $4, $5::date, $6,
       $7, $8,
       $9, $10, $11,
       $12, $13, $14,
       $15, $16, $17, $18,
       $19, $20::jsonb, 'SUBMITTED', 'PENDING_INTAKE'
     )
     RETURNING id`,
    [
      input.tenantId,
      input.clientId,
      input.manufacturerId,
      input.productType,
      input.dealDate,
      input.expectedAmount,
      input.calculationBaseAmount,
      input.manualAmount,
      input.expectedGrossScope,
      input.expectedNetScope,
      input.expectedGrossMonthlyOngoing,
      input.expectedNetMonthlyOngoing,
      input.expectedAnnualPaceGross,
      input.expectedAnnualPaceNet,
      input.entersAum,
      input.showSeparateBase,
      input.requiresManualAmount,
      input.calculationBase,
      input.agreementVersionId,
      JSON.stringify(input.ruleSnapshot),
    ],
  );
  const created = rows[0];
  if (!created) {
    throw new Error('DEAL_INSERT_FAILED');
  }
  const deal = await findDealForUpdate(db, created.id);
  if (!deal) {
    throw new Error('DEAL_INSERT_FAILED');
  }
  return deal;
}

export async function markAbsorbed(
  db: Db,
  input: {
    dealId: string;
    absorbedOn: string;
    actualAmount: number;
    calculationBaseAmount: number | null;
    manualAmount: number | null;
    recognizedGrossScope: number;
    recognizedNetScope: number;
    recognizedGrossMonthlyOngoing: number;
    recognizedNetMonthlyOngoing: number;
    recognizedAnnualPaceGross: number;
    recognizedAnnualPaceNet: number;
    entersAum: boolean;
    showSeparateBase: boolean;
    requiresManualAmount: boolean;
    calculationBase: CalculationBase;
    agreementVersionId: string;
    ruleSnapshot: unknown;
  },
): Promise<DealRecord> {
  await db.query(
    `UPDATE deals SET
       absorbed_on = $2::date,
       actual_amount = $3,
       calculation_base_amount = $4,
       manual_amount = $5,
       recognized_gross_scope = $6,
       recognized_net_scope = $7,
       recognized_gross_monthly_ongoing = $8,
       recognized_net_monthly_ongoing = $9,
       recognized_annual_pace_gross = $10,
       recognized_annual_pace_net = $11,
       enters_aum = $12,
       show_separate_base = $13,
       requires_manual_amount = $14,
       calculation_base = $15,
       agreement_version_id = $16,
       rule_snapshot = $17::jsonb,
       deal_status = 'ABSORBED',
       reconciliation_status = 'PENDING_REVIEW',
       updated_at = now()
     WHERE id = $1`,
    [
      input.dealId,
      input.absorbedOn,
      input.actualAmount,
      input.calculationBaseAmount,
      input.manualAmount,
      input.recognizedGrossScope,
      input.recognizedNetScope,
      input.recognizedGrossMonthlyOngoing,
      input.recognizedNetMonthlyOngoing,
      input.recognizedAnnualPaceGross,
      input.recognizedAnnualPaceNet,
      input.entersAum,
      input.showSeparateBase,
      input.requiresManualAmount,
      input.calculationBase,
      input.agreementVersionId,
      JSON.stringify(input.ruleSnapshot),
    ],
  );
  const deal = await findDealForUpdate(db, input.dealId);
  if (!deal) {
    throw new Error('DEAL_UPDATE_FAILED');
  }
  return deal;
}

export async function updateSubmittedDeal(
  db: Db,
  input: {
    dealId: string;
    clientId: string;
    manufacturerId: string;
    productType: ProductType;
    dealDate: string;
    expectedAmount: number;
    calculationBaseAmount: number | null;
    manualAmount: number | null;
    expectedGrossScope: number;
    expectedNetScope: number;
    expectedGrossMonthlyOngoing: number;
    expectedNetMonthlyOngoing: number;
    expectedAnnualPaceGross: number;
    expectedAnnualPaceNet: number;
    entersAum: boolean;
    showSeparateBase: boolean;
    requiresManualAmount: boolean;
    calculationBase: CalculationBase;
    agreementVersionId: string;
    ruleSnapshot: unknown;
    note: string | null;
  },
): Promise<DealRecord> {
  await db.query(
    `UPDATE deals SET
       client_id = $2,
       manufacturer_id = $3,
       product_type = $4,
       deal_date = $5::date,
       expected_amount = $6,
       calculation_base_amount = $7,
       manual_amount = $8,
       expected_gross_scope = $9,
       expected_net_scope = $10,
       expected_gross_monthly_ongoing = $11,
       expected_net_monthly_ongoing = $12,
       expected_annual_pace_gross = $13,
       expected_annual_pace_net = $14,
       enters_aum = $15,
       show_separate_base = $16,
       requires_manual_amount = $17,
       calculation_base = $18,
       agreement_version_id = $19,
       rule_snapshot = $20::jsonb,
       note = $21,
       updated_at = now()
     WHERE id = $1`,
    [
      input.dealId,
      input.clientId,
      input.manufacturerId,
      input.productType,
      input.dealDate,
      input.expectedAmount,
      input.calculationBaseAmount,
      input.manualAmount,
      input.expectedGrossScope,
      input.expectedNetScope,
      input.expectedGrossMonthlyOngoing,
      input.expectedNetMonthlyOngoing,
      input.expectedAnnualPaceGross,
      input.expectedAnnualPaceNet,
      input.entersAum,
      input.showSeparateBase,
      input.requiresManualAmount,
      input.calculationBase,
      input.agreementVersionId,
      JSON.stringify(input.ruleSnapshot),
      input.note,
    ],
  );
  const deal = await findDealForUpdate(db, input.dealId);
  if (!deal) {
    throw new Error('DEAL_UPDATE_FAILED');
  }
  return deal;
}

export async function updateSubmittedIdentity(
  db: Db,
  dealId: string,
  clientId: string,
  note: string | null,
): Promise<DealRecord> {
  await db.query(
    `UPDATE deals SET client_id = $2, note = $3, updated_at = now() WHERE id = $1`,
    [dealId, clientId, note],
  );
  const deal = await findDealForUpdate(db, dealId);
  if (!deal) {
    throw new Error('DEAL_UPDATE_FAILED');
  }
  return deal;
}

export async function correctAbsorbedSnapshot(
  db: Db,
  input: {
    dealId: string;
    actualAmount: number;
    calculationBaseAmount: number | null;
    manualAmount: number | null;
    recognizedGrossScope: number;
    recognizedNetScope: number;
    recognizedGrossMonthlyOngoing: number;
    recognizedNetMonthlyOngoing: number;
    recognizedAnnualPaceGross: number;
    recognizedAnnualPaceNet: number;
    entersAum: boolean;
    showSeparateBase: boolean;
    requiresManualAmount: boolean;
    calculationBase: CalculationBase;
    agreementVersionId: string;
    ruleSnapshot: unknown;
  },
): Promise<DealRecord> {
  await db.query(
    `UPDATE deals SET
       actual_amount = $2,
       calculation_base_amount = $3,
       manual_amount = $4,
       recognized_gross_scope = $5,
       recognized_net_scope = $6,
       recognized_gross_monthly_ongoing = $7,
       recognized_net_monthly_ongoing = $8,
       recognized_annual_pace_gross = $9,
       recognized_annual_pace_net = $10,
       enters_aum = $11,
       show_separate_base = $12,
       requires_manual_amount = $13,
       calculation_base = $14,
       agreement_version_id = $15,
       rule_snapshot = $16::jsonb,
       updated_at = now()
     WHERE id = $1`,
    [
      input.dealId,
      input.actualAmount,
      input.calculationBaseAmount,
      input.manualAmount,
      input.recognizedGrossScope,
      input.recognizedNetScope,
      input.recognizedGrossMonthlyOngoing,
      input.recognizedNetMonthlyOngoing,
      input.recognizedAnnualPaceGross,
      input.recognizedAnnualPaceNet,
      input.entersAum,
      input.showSeparateBase,
      input.requiresManualAmount,
      input.calculationBase,
      input.agreementVersionId,
      JSON.stringify(input.ruleSnapshot),
    ],
  );
  const deal = await findDealForUpdate(db, input.dealId);
  if (!deal) {
    throw new Error('DEAL_UPDATE_FAILED');
  }
  return deal;
}

export async function updateReconciliation(
  db: Db,
  dealId: string,
  status: 'PENDING_REVIEW' | 'MATCHED' | 'DISCREPANCY',
  note: string | null,
): Promise<DealRecord> {
  await db.query(
    `UPDATE deals
     SET reconciliation_status = $2, note = $3, updated_at = now()
     WHERE id = $1`,
    [dealId, status, note],
  );
  const deal = await findDealForUpdate(db, dealId);
  if (!deal) {
    throw new Error('DEAL_UPDATE_FAILED');
  }
  return deal;
}

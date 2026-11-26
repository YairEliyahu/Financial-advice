import { asDateString, asNullableDateString, toNullableNumber, toNumber } from '../../db/numbers.js';
import { queryRows, type Db } from '../../db/transaction.js';
import {
  isCalculationBase,
  isManufacturerType,
  isPaymentFrequency,
  isProductType,
} from '../commission/catalog.js';
import type { ScopeRateType } from '../commission/commission.rules.js';
import type { CommissionRuleRecord } from '../commission/rule.types.js';

export interface AgreementVersionRecord {
  id: string;
  validFrom: string;
  validTo: string | null;
  vatRate: number;
  hqOverheadRate: number;
  partnerSplitRate: number;
  meetingQuota: number;
  meetingCost: number;
  vehicleCredit: number;
}

export interface TenantTargets {
  monthlyRecruitmentTarget: number;
  annualRecruitmentTarget: number;
}

interface VersionRow {
  id: string;
  valid_from: string;
  valid_to: string | null;
  vat_rate: string;
  hq_overhead_rate: string;
  partner_split_rate: string;
  meeting_quota: number;
  meeting_cost: string;
  vehicle_credit: string;
}

interface RuleRow {
  id: string;
  product_type: string;
  manufacturer_type: string;
  manufacturer_id: string | null;
  scope_rate_type: string;
  scope_rate_value: string | null;
  annual_cap: string | null;
  ongoing_rate: string;
  calculation_base: string;
  payment_frequency: string;
  enters_aum: boolean;
  requires_manual_amount: boolean;
}

interface TargetRow {
  monthly_recruitment_target: string;
  annual_recruitment_target: string;
}

const SCOPE_TYPES = ['FIXED', 'PERCENT', 'PER_MILLION'] as const;

function isScopeRateType(value: string): value is ScopeRateType {
  return (SCOPE_TYPES as readonly string[]).includes(value);
}

function mapVersion(row: VersionRow): AgreementVersionRecord {
  return {
    id: row.id,
    validFrom: asDateString(row.valid_from),
    validTo: asNullableDateString(row.valid_to),
    vatRate: toNumber(row.vat_rate),
    hqOverheadRate: toNumber(row.hq_overhead_rate),
    partnerSplitRate: toNumber(row.partner_split_rate),
    meetingQuota: row.meeting_quota,
    meetingCost: toNumber(row.meeting_cost),
    vehicleCredit: toNumber(row.vehicle_credit),
  };
}

function mapRule(row: RuleRow): CommissionRuleRecord {
  if (
    !isProductType(row.product_type) ||
    !isManufacturerType(row.manufacturer_type) ||
    !isScopeRateType(row.scope_rate_type) ||
    !isCalculationBase(row.calculation_base) ||
    !isPaymentFrequency(row.payment_frequency)
  ) {
    throw new Error('INVALID_COMMISSION_RULE');
  }
  return {
    id: row.id,
    productType: row.product_type,
    manufacturerType: row.manufacturer_type,
    manufacturerId: row.manufacturer_id,
    scopeRateType: row.scope_rate_type,
    scopeRateValue: toNullableNumber(row.scope_rate_value),
    annualCap: toNullableNumber(row.annual_cap),
    ongoingRate: toNumber(row.ongoing_rate),
    calculationBase: row.calculation_base,
    paymentFrequency: row.payment_frequency,
    entersAum: row.enters_aum,
    requiresManualAmount: row.requires_manual_amount,
  };
}

export async function findVersionForDate(db: Db, date: string): Promise<AgreementVersionRecord | null> {
  const rows = await queryRows<VersionRow>(
    db,
    `SELECT id, valid_from, valid_to, vat_rate, hq_overhead_rate, partner_split_rate,
            meeting_quota, meeting_cost, vehicle_credit
     FROM agreement_versions
     WHERE valid_from <= $1::date
       AND (valid_to IS NULL OR valid_to >= $1::date)
     ORDER BY valid_from DESC
     LIMIT 1`,
    [date],
  );
  const row = rows[0];
  return row ? mapVersion(row) : null;
}

export async function findOpenVersion(db: Db): Promise<AgreementVersionRecord | null> {
  const rows = await queryRows<VersionRow>(
    db,
    `SELECT id, valid_from, valid_to, vat_rate, hq_overhead_rate, partner_split_rate,
            meeting_quota, meeting_cost, vehicle_credit
     FROM agreement_versions
     WHERE valid_to IS NULL
     ORDER BY valid_from DESC
     LIMIT 1`,
  );
  const row = rows[0];
  return row ? mapVersion(row) : null;
}

export async function listRules(db: Db, agreementVersionId: string): Promise<CommissionRuleRecord[]> {
  const rows = await queryRows<RuleRow>(
    db,
    `SELECT id, product_type, manufacturer_type, manufacturer_id, scope_rate_type,
            scope_rate_value, annual_cap, ongoing_rate, calculation_base, payment_frequency,
            enters_aum, requires_manual_amount
     FROM commission_rules
     WHERE agreement_version_id = $1
     ORDER BY product_type, manufacturer_type, manufacturer_id NULLS FIRST`,
    [agreementVersionId],
  );
  return rows.map(mapRule);
}

export async function getTargets(db: Db): Promise<TenantTargets> {
  const rows = await queryRows<TargetRow>(
    db,
    `SELECT monthly_recruitment_target, annual_recruitment_target FROM tenants`,
  );
  const row = rows[0];
  if (!row) {
    throw new Error('TENANT_NOT_VISIBLE');
  }
  return {
    monthlyRecruitmentTarget: toNumber(row.monthly_recruitment_target),
    annualRecruitmentTarget: toNumber(row.annual_recruitment_target),
  };
}

export async function updateTargets(db: Db, targets: TenantTargets): Promise<TenantTargets> {
  const rows = await queryRows<TargetRow>(
    db,
    `UPDATE tenants
     SET monthly_recruitment_target = $1, annual_recruitment_target = $2
     RETURNING monthly_recruitment_target, annual_recruitment_target`,
    [targets.monthlyRecruitmentTarget, targets.annualRecruitmentTarget],
  );
  const row = rows[0];
  if (!row) {
    throw new Error('TENANT_NOT_VISIBLE');
  }
  return {
    monthlyRecruitmentTarget: toNumber(row.monthly_recruitment_target),
    annualRecruitmentTarget: toNumber(row.annual_recruitment_target),
  };
}

export async function closeVersion(db: Db, versionId: string, validTo: string): Promise<void> {
  await db.query(`UPDATE agreement_versions SET valid_to = $2::date WHERE id = $1`, [versionId, validTo]);
}

export async function insertVersion(
  db: Db,
  tenantId: string,
  input: Omit<AgreementVersionRecord, 'id' | 'validTo'> & { validTo: null },
): Promise<AgreementVersionRecord> {
  const rows = await queryRows<VersionRow>(
    db,
    `INSERT INTO agreement_versions (
       id, tenant_id, valid_from, valid_to, vat_rate, hq_overhead_rate, partner_split_rate,
       meeting_quota, meeting_cost, vehicle_credit
     ) VALUES (gen_random_uuid(), $1, $2::date, NULL, $3, $4, $5, $6, $7, $8)
     RETURNING id, valid_from, valid_to, vat_rate, hq_overhead_rate, partner_split_rate,
               meeting_quota, meeting_cost, vehicle_credit`,
    [
      tenantId,
      input.validFrom,
      input.vatRate,
      input.hqOverheadRate,
      input.partnerSplitRate,
      input.meetingQuota,
      input.meetingCost,
      input.vehicleCredit,
    ],
  );
  const row = rows[0];
  if (!row) {
    throw new Error('VERSION_INSERT_FAILED');
  }
  return mapVersion(row);
}

export async function copyRules(db: Db, tenantId: string, fromVersionId: string, toVersionId: string): Promise<void> {
  await db.query(
    `INSERT INTO commission_rules (
       id, tenant_id, agreement_version_id, product_type, manufacturer_type, manufacturer_id,
       scope_rate_type, scope_rate_value, annual_cap, ongoing_rate, calculation_base,
       payment_frequency, enters_aum, requires_manual_amount
     )
     SELECT gen_random_uuid(), $1, $3, product_type, manufacturer_type, manufacturer_id,
            scope_rate_type, scope_rate_value, annual_cap, ongoing_rate, calculation_base,
            payment_frequency, enters_aum, requires_manual_amount
     FROM commission_rules
     WHERE agreement_version_id = $2`,
    [tenantId, fromVersionId, toVersionId],
  );
}

import { DomainError } from '../../domain/errors.js';
import { withTenantTransaction } from '../../db/transaction.js';
import { describeCommissionRule, ruleLabels } from '../commission/commission.service.js';
import type { CommissionRuleRecord } from '../commission/rule.types.js';
import * as agreementsModel from './agreements.model.js';
import * as manufacturersModel from '../manufacturers/manufacturers.model.js';
import { jerusalemToday } from '../dashboard/dates.js';

export interface AgreementRuleView {
  id: string;
  productType: CommissionRuleRecord['productType'];
  productLabel: string;
  manufacturerType: CommissionRuleRecord['manufacturerType'];
  manufacturerTypeLabel: string;
  manufacturerId: string | null;
  manufacturerName: string | null;
  summary: string;
  requiresManualAmount: boolean;
  entersAum: boolean;
  calculationBase: CommissionRuleRecord['calculationBase'];
}

function dayBefore(isoDate: string): string {
  const [yearText, monthText, dayText] = isoDate.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function presentRules(db: Parameters<typeof manufacturersModel.listManufacturers>[0], rules: CommissionRuleRecord[]) {
  const manufacturers = await manufacturersModel.listManufacturers(db);
  return rules.map((rule) => {
    const labels = ruleLabels(rule);
    const manufacturer = manufacturers.find((item) => item.id === rule.manufacturerId);
    const view: AgreementRuleView = {
      id: rule.id,
      productType: rule.productType,
      productLabel: labels.productLabel,
      manufacturerType: rule.manufacturerType,
      manufacturerTypeLabel: labels.manufacturerTypeLabel,
      manufacturerId: rule.manufacturerId,
      manufacturerName: manufacturer?.nameHe ?? null,
      summary: describeCommissionRule(rule),
      requiresManualAmount: rule.requiresManualAmount,
      entersAum: rule.entersAum,
      calculationBase: rule.calculationBase,
    };
    return view;
  });
}

export async function currentAgreement(tenantId: string) {
  return withTenantTransaction(tenantId, async (db) => {
    const version = await agreementsModel.findVersionForDate(db, jerusalemToday());
    if (!version) {
      throw new DomainError('NO_AGREEMENT');
    }
    const [rules, targets] = await Promise.all([
      agreementsModel.listRules(db, version.id),
      agreementsModel.getTargets(db),
    ]);
    return {
      version,
      targets,
      rules: await presentRules(db, rules),
    };
  });
}

export async function updateTargets(
  tenantId: string,
  targets: agreementsModel.TenantTargets,
): Promise<agreementsModel.TenantTargets> {
  return withTenantTransaction(tenantId, (db) => agreementsModel.updateTargets(db, targets));
}

export async function openNewVersion(
  tenantId: string,
  input: {
    validFrom: string;
    vatRate: number;
    hqOverheadRate: number;
    partnerSplitRate: number;
    meetingQuota: number;
    meetingCost: number;
    vehicleCredit: number;
  },
) {
  return withTenantTransaction(tenantId, async (db) => {
    const current = await agreementsModel.findOpenVersion(db);
    if (!current) {
      throw new DomainError('NO_AGREEMENT');
    }
    if (input.validFrom <= current.validFrom) {
      throw new DomainError('VERSION_CONFLICT');
    }
    await agreementsModel.closeVersion(db, current.id, dayBefore(input.validFrom));
    const created = await agreementsModel.insertVersion(db, tenantId, { ...input, validTo: null });
    await agreementsModel.copyRules(db, tenantId, current.id, created.id);
    const rules = await agreementsModel.listRules(db, created.id);
    return {
      version: created,
      rules: await presentRules(db, rules),
    };
  });
}

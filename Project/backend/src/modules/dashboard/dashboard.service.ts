import { roundMoney } from '../commission/commission.rules.js';
import { PRODUCT_LABELS } from '../commission/catalog.js';
import { withTenantTransaction } from '../../db/transaction.js';
import * as agreementsModel from '../agreements/agreements.model.js';
import * as dealsModel from '../deals/deals.model.js';
import { hebrewMonthLabel, monthBounds, yearBounds } from './dates.js';

function inRange(date: string | null, start: string, end: string): boolean {
  return date != null && date >= start && date < end;
}

function completion(actual: number, target: number): { completionPercent: number; barPercent: number; targetDefined: boolean } {
  if (target <= 0) {
    return { completionPercent: 0, barPercent: 0, targetDefined: false };
  }
  const completionPercent = roundMoney((actual / target) * 100);
  return {
    completionPercent,
    barPercent: Math.min(100, completionPercent),
    targetDefined: true,
  };
}

function periodStats(deals: dealsModel.DealRecord[], start: string, end: string) {
  const recruited = deals.filter(
    (deal) =>
      deal.dealStatus === 'ABSORBED' &&
      deal.entersAum &&
      !deal.isBasePortfolio &&
      inRange(deal.absorbedOn, start, end),
  );
  const actual = recruited.reduce((sum, deal) => sum + (deal.actualAmount ?? 0), 0);
  const gross = recruited.reduce((sum, deal) => sum + (deal.recognizedGrossScope ?? 0), 0);
  return {
    actual: roundMoney(actual),
    dealCount: recruited.length,
    averageGrossScope: recruited.length > 0 ? roundMoney(gross / recruited.length) : 0,
  };
}

export async function dashboard(tenantId: string, year: number, month: number) {
  return withTenantTransaction(tenantId, async (db) => {
    const [deals, targets] = await Promise.all([dealsModel.listDeals(db), agreementsModel.getTargets(db)]);
    const monthRange = monthBounds(year, month);
    const yearRange = yearBounds(year);
    const absorbed = deals.filter((deal) => deal.dealStatus === 'ABSORBED');
    const aumDeals = absorbed.filter((deal) => deal.entersAum);
    const base = roundMoney(
      aumDeals.filter((deal) => deal.isBasePortfolio).reduce((sum, deal) => sum + (deal.actualAmount ?? 0), 0),
    );
    const partnership = roundMoney(
      aumDeals.filter((deal) => !deal.isBasePortfolio).reduce((sum, deal) => sum + (deal.actualAmount ?? 0), 0),
    );
    const absorbedThisMonth = absorbed.filter((deal) => inRange(deal.absorbedOn, monthRange.start, monthRange.end));
    const scopeNet = roundMoney(absorbedThisMonth.reduce((sum, deal) => sum + (deal.recognizedNetScope ?? 0), 0));
    const ongoingMonthlyNet = roundMoney(
      absorbedThisMonth.reduce((sum, deal) => sum + (deal.recognizedNetMonthlyOngoing ?? 0), 0),
    );
    const annualPaceNet = roundMoney(
      absorbedThisMonth.reduce((sum, deal) => sum + (deal.recognizedAnnualPaceNet ?? 0), 0),
    );
    const monthRecruitment = periodStats(deals, monthRange.start, monthRange.end);
    const yearRecruitment = periodStats(deals, yearRange.start, yearRange.end);
    const byManufacturer = new Map<string, { id: string; name: string; amount: number }>();
    for (const deal of aumDeals) {
      const current = byManufacturer.get(deal.manufacturerId) ?? {
        id: deal.manufacturerId,
        name: deal.manufacturerName,
        amount: 0,
      };
      current.amount += deal.actualAmount ?? 0;
      byManufacturer.set(deal.manufacturerId, current);
    }
    const aumTotal = roundMoney(base + partnership);
    const manufacturers = [...byManufacturer.values()]
      .map((item) => ({
        id: item.id,
        name: item.name,
        amount: roundMoney(item.amount),
        percent: aumTotal > 0 ? roundMoney((item.amount / aumTotal) * 100) : 0,
      }))
      .sort((left, right) => right.amount - left.amount);

    const discrepancies = deals
      .filter((deal) => deal.reconciliationStatus === 'DISCREPANCY')
      .map((deal) => ({
        id: deal.id,
        clientName: deal.clientName,
        manufacturerName: deal.manufacturerName,
        productLabel: PRODUCT_LABELS[deal.productType],
        note: deal.note,
        actualAmount: deal.actualAmount,
      }));

    return {
      month: `${year}-${String(month).padStart(2, '0')}`,
      monthLabel: hebrewMonthLabel(year, month),
      year,
      discrepancies,
      aum: { total: aumTotal, base, partnership },
      monthRewards: {
        scopeNet,
        ongoingMonthlyNet,
        annualPaceNet,
        totalNet: roundMoney(scopeNet + ongoingMonthlyNet),
      },
      targets: {
        month: { target: targets.monthlyRecruitmentTarget, ...monthRecruitment, ...completion(monthRecruitment.actual, targets.monthlyRecruitmentTarget) },
        year: { target: targets.annualRecruitmentTarget, ...yearRecruitment, ...completion(yearRecruitment.actual, targets.annualRecruitmentTarget) },
      },
      manufacturers,
    };
  });
}

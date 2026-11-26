import { queryRows, withTenantTransaction } from '../../db/transaction.js';
import { roundMoney } from '../commission/commission.rules.js';
import { PRODUCT_LABELS } from '../commission/catalog.js';
import * as agreementsModel from '../agreements/agreements.model.js';
import * as dealsModel from '../deals/deals.model.js';
import { hebrewMonthLabel, monthBounds, rangeBounds, rangeLabel, yearBounds, type DashboardRange } from './dates.js';

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

function rewardsFor(deals: dealsModel.DealRecord[], start: string, end: string) {
  const absorbed = deals.filter((deal) => deal.dealStatus === 'ABSORBED' && inRange(deal.absorbedOn, start, end));
  const scopeNet = roundMoney(absorbed.reduce((sum, deal) => sum + (deal.recognizedNetScope ?? 0), 0));
  const ongoingMonthlyNet = roundMoney(absorbed.reduce((sum, deal) => sum + (deal.recognizedNetMonthlyOngoing ?? 0), 0));
  const annualPaceNet = roundMoney(absorbed.reduce((sum, deal) => sum + (deal.recognizedAnnualPaceNet ?? 0), 0));
  return {
    scopeNet,
    ongoingMonthlyNet,
    annualPaceNet,
    totalNet: roundMoney(scopeNet + ongoingMonthlyNet),
  };
}

function bucketStart(date: string, grain: 'day' | 'month'): string {
  return grain === 'day' ? date : `${date.slice(0, 7)}-01`;
}

function bucketsFor(start: string, end: string, grain: 'day' | 'month'): string[] {
  if (grain === 'month') {
    const keys: string[] = [];
    let year = Number(start.slice(0, 4));
    let month = Number(start.slice(5, 7));
    while (`${year}-${String(month).padStart(2, '0')}-01` < end) {
      keys.push(`${year}-${String(month).padStart(2, '0')}-01`);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return keys;
  }
  const keys: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const stop = new Date(`${end}T00:00:00Z`);
  while (cursor < stop) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

export async function dashboard(tenantId: string, year: number, month: number, range: DashboardRange) {
  return withTenantTransaction(tenantId, async (db) => {
    const [deals, targets, tenantRows, clientRows] = await Promise.all([
      dealsModel.listDeals(db),
      agreementsModel.getTargets(db),
      queryRows<{ name: string }>(db, `SELECT name FROM tenants LIMIT 1`),
      queryRows<{ count: string }>(db, `SELECT count(*)::text AS count FROM clients`),
    ]);
    const monthRange = monthBounds(year, month);
    const yearRange = yearBounds(year);
    const selected = rangeBounds(range, year, month);
    const grain = range === 'month' ? 'day' : 'month';
    const absorbed = deals.filter((deal) => deal.dealStatus === 'ABSORBED');
    const aumDeals = absorbed.filter((deal) => deal.entersAum);
    const base = roundMoney(
      aumDeals.filter((deal) => deal.isBasePortfolio).reduce((sum, deal) => sum + (deal.actualAmount ?? 0), 0),
    );
    const partnership = roundMoney(
      aumDeals.filter((deal) => !deal.isBasePortfolio).reduce((sum, deal) => sum + (deal.actualAmount ?? 0), 0),
    );
    const monthRecruitment = periodStats(deals, monthRange.start, monthRange.end);
    const yearRecruitment = periodStats(deals, yearRange.start, yearRange.end);
    const rangeRecruitment = periodStats(deals, selected.start, selected.end);
    const rangeTarget =
      range === 'year'
        ? targets.annualRecruitmentTarget
        : range === 'quarter'
          ? roundMoney(targets.monthlyRecruitmentTarget * 3)
          : targets.monthlyRecruitmentTarget;
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

    const trendMap = new Map(bucketsFor(selected.start, selected.end, grain).map((date) => [date, { registered: 0, absorbed: 0, scopeNet: 0 }]));
    for (const deal of deals) {
      if (deal.entersAum && !deal.isBasePortfolio && inRange(deal.dealDate, selected.start, selected.end)) {
        const bucket = trendMap.get(bucketStart(deal.dealDate, grain));
        if (bucket) {
          bucket.registered += deal.expectedAmount;
        }
      }
      if (deal.dealStatus === 'ABSORBED' && inRange(deal.absorbedOn, selected.start, selected.end)) {
        const bucket = deal.absorbedOn ? trendMap.get(bucketStart(deal.absorbedOn, grain)) : undefined;
        if (bucket) {
          bucket.scopeNet += deal.recognizedNetScope ?? 0;
          if (deal.entersAum && !deal.isBasePortfolio) {
            bucket.absorbed += deal.actualAmount ?? 0;
          }
        }
      }
    }
    const trend = [...trendMap.entries()].map(([date, value]) => ({
      date,
      registered: roundMoney(value.registered),
      absorbed: roundMoney(value.absorbed),
      scopeNet: roundMoney(value.scopeNet),
    }));

    const submittedInRange = deals.filter((deal) => inRange(deal.dealDate, selected.start, selected.end));
    const absorbedInRange = deals.filter((deal) => deal.dealStatus === 'ABSORBED' && inRange(deal.absorbedOn, selected.start, selected.end));
    const funnel = {
      submitted: submittedInRange.length,
      absorbed: absorbedInRange.length,
      matched: absorbedInRange.filter((deal) => deal.reconciliationStatus === 'MATCHED').length,
      discrepancy: deals.filter(
        (deal) =>
          deal.reconciliationStatus === 'DISCREPANCY' &&
          (inRange(deal.dealDate, selected.start, selected.end) || inRange(deal.absorbedOn, selected.start, selected.end)),
      ).length,
    };

    const discrepancies = deals
      .filter((deal) => deal.reconciliationStatus === 'DISCREPANCY')
      .map((deal) => ({
        id: deal.id,
        clientName: deal.clientName,
        manufacturerName: deal.manufacturerName,
        productLabel: PRODUCT_LABELS[deal.productType],
        note: deal.note,
        actualAmount: deal.actualAmount,
        dealDate: deal.dealDate,
      }));

    const activity = deals
      .flatMap((deal) => {
        const events: Array<{
          id: string;
          dealId: string;
          kind: 'SUBMITTED' | 'ABSORBED' | 'MATCHED' | 'DISCREPANCY';
          date: string;
          clientName: string;
          manufacturerName: string;
          productLabel: string;
          amount: number | null;
        }> = [
          {
            id: `${deal.id}:submitted`,
            dealId: deal.id,
            kind: 'SUBMITTED',
            date: deal.dealDate,
            clientName: deal.clientName,
            manufacturerName: deal.manufacturerName,
            productLabel: PRODUCT_LABELS[deal.productType],
            amount: deal.expectedAmount,
          },
        ];
        if (deal.absorbedOn) {
          events.push({
            id: `${deal.id}:absorbed`,
            dealId: deal.id,
            kind: 'ABSORBED',
            date: deal.absorbedOn,
            clientName: deal.clientName,
            manufacturerName: deal.manufacturerName,
            productLabel: PRODUCT_LABELS[deal.productType],
            amount: deal.actualAmount,
          });
        }
        if (deal.reconciliationStatus === 'MATCHED' && deal.absorbedOn) {
          events.push({
            id: `${deal.id}:matched`,
            dealId: deal.id,
            kind: 'MATCHED',
            date: deal.absorbedOn,
            clientName: deal.clientName,
            manufacturerName: deal.manufacturerName,
            productLabel: PRODUCT_LABELS[deal.productType],
            amount: deal.actualAmount,
          });
        }
        if (deal.reconciliationStatus === 'DISCREPANCY') {
          events.push({
            id: `${deal.id}:discrepancy`,
            dealId: deal.id,
            kind: 'DISCREPANCY',
            date: deal.absorbedOn ?? deal.dealDate,
            clientName: deal.clientName,
            manufacturerName: deal.manufacturerName,
            productLabel: PRODUCT_LABELS[deal.productType],
            amount: deal.actualAmount,
          });
        }
        return events;
      })
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 8);

    const recentDeals = [...deals]
      .sort((left, right) => right.dealDate.localeCompare(left.dealDate))
      .slice(0, 12)
      .map((deal) => ({
        id: deal.id,
        clientName: deal.clientName,
        manufacturerId: deal.manufacturerId,
        manufacturerName: deal.manufacturerName,
        productLabel: PRODUCT_LABELS[deal.productType],
        dealDate: deal.dealDate,
        amount: deal.actualAmount ?? deal.expectedAmount,
        dealStatus: deal.dealStatus,
        reconciliationStatus: deal.reconciliationStatus,
      }));

    const clientCount = Number(clientRows[0]?.count ?? 0);
    const monthRewards = rewardsFor(deals, monthRange.start, monthRange.end);

    return {
      month: `${year}-${String(month).padStart(2, '0')}`,
      monthLabel: hebrewMonthLabel(year, month),
      year,
      range,
      periodLabel: rangeLabel(range, year, month),
      periodStart: selected.start,
      periodEnd: selected.end,
      advisorName: tenantRows[0]?.name ?? '',
      clientCount,
      discrepancies,
      activity,
      aum: { total: aumTotal, base, partnership },
      monthRewards,
      rewards: rewardsFor(deals, selected.start, selected.end),
      targets: {
        month: { target: targets.monthlyRecruitmentTarget, ...monthRecruitment, ...completion(monthRecruitment.actual, targets.monthlyRecruitmentTarget) },
        year: { target: targets.annualRecruitmentTarget, ...yearRecruitment, ...completion(yearRecruitment.actual, targets.annualRecruitmentTarget) },
      },
      goal: {
        label: range === 'year' ? 'יעד שנתי' : range === 'quarter' ? 'יעד רבעוני' : 'יעד חודשי',
        hint: range === 'quarter' ? 'יעד חודשי × 3' : null,
        ...rangeRecruitment,
        ...completion(rangeRecruitment.actual, rangeTarget),
        target: rangeTarget,
      },
      funnel,
      trend,
      manufacturers,
      recentDeals,
    };
  });
}

export interface SessionUser {
  userId: string;
  phone: string;
  today: string;
}

export interface Client {
  id: string;
  fullName: string;
  idNumberMasked: string;
  birthDate: string | null;
  isBasePortfolio: boolean;
  status: string;
}

export interface Manufacturer {
  id: string;
  nameHe: string;
  manufacturerType: 'INVESTMENT_HOUSE' | 'INSURANCE';
  manufacturerTypeLabel: string;
}

export interface ProductOption {
  productType: string;
  label: string;
}

export interface Preview {
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

export interface Deal {
  id: string;
  clientId: string;
  clientName: string;
  isBasePortfolio: boolean;
  manufacturerId: string;
  manufacturerName: string;
  productType: string;
  productLabel: string;
  dealDate: string;
  absorbedOn: string | null;
  expectedAmount: number;
  actualAmount: number | null;
  showSeparateBase: boolean;
  requiresManualAmount: boolean;
  expectedGrossScope: number | null;
  expectedNetScope: number | null;
  expectedGrossMonthlyOngoing: number | null;
  recognizedGrossScope: number | null;
  recognizedNetScope: number | null;
  recognizedGrossMonthlyOngoing: number | null;
  recognizedAnnualPaceNet: number | null;
  calculationBaseAmount: number | null;
  manualAmount: number | null;
  calculationBase: string | null;
  calculationBaseLabel: string | null;
  dealStatus: 'SUBMITTED' | 'ABSORBED' | 'CHURNED';
  dealStatusLabel: string;
  reconciliationStatus: 'PENDING_INTAKE' | 'PENDING_REVIEW' | 'MATCHED' | 'DISCREPANCY';
  reconciliationStatusLabel: string;
  note: string | null;
  entersAum: boolean;
}

export interface TargetPeriod {
  target: number;
  actual: number;
  dealCount: number;
  averageGrossScope: number;
  completionPercent: number;
  barPercent: number;
  targetDefined: boolean;
}

export type DashboardRange = 'month' | 'quarter' | 'year';

export interface Dashboard {
  month: string;
  monthLabel: string;
  year: number;
  range: DashboardRange;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  advisorName: string;
  clientCount: number;
  discrepancies: Array<{
    id: string;
    clientName: string;
    manufacturerName: string;
    productLabel: string;
    note: string | null;
    actualAmount: number | null;
    dealDate: string;
  }>;
  activity: Array<{
    id: string;
    dealId: string;
    kind: 'SUBMITTED' | 'ABSORBED' | 'MATCHED' | 'DISCREPANCY';
    date: string;
    clientName: string;
    manufacturerName: string;
    productLabel: string;
    amount: number | null;
  }>;
  aum: { total: number; base: number; partnership: number };
  monthRewards: {
    scopeNet: number;
    ongoingMonthlyNet: number;
    annualPaceNet: number;
    totalNet: number;
  };
  rewards: {
    scopeNet: number;
    ongoingMonthlyNet: number;
    annualPaceNet: number;
    totalNet: number;
  };
  targets: { month: TargetPeriod; year: TargetPeriod };
  goal: TargetPeriod & { label: string; hint: string | null };
  funnel: { submitted: number; absorbed: number; matched: number; discrepancy: number };
  trend: Array<{ date: string; registered: number; absorbed: number; scopeNet: number }>;
  manufacturers: Array<{ id: string; name: string; amount: number; percent: number }>;
  recentDeals: Array<{
    id: string;
    clientName: string;
    manufacturerId: string;
    manufacturerName: string;
    productLabel: string;
    dealDate: string;
    amount: number;
    dealStatus: Deal['dealStatus'];
    reconciliationStatus: Deal['reconciliationStatus'];
  }>;
}

export interface AgreementRule {
  id: string;
  productLabel: string;
  manufacturerTypeLabel: string;
  manufacturerName: string | null;
  summary: string;
  requiresManualAmount: boolean;
}

export interface Agreement {
  version: {
    id: string;
    validFrom: string;
    validTo: string | null;
    vatRate: number;
    hqOverheadRate: number;
    partnerSplitRate: number;
    meetingQuota: number;
    meetingCost: number;
    vehicleCredit: number;
  };
  targets: { monthlyRecruitmentTarget: number; annualRecruitmentTarget: number };
  rules: AgreementRule[];
}

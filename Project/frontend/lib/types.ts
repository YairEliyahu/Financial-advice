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
  calculationBaseLabel?: string;
  expectedGrossScope: number | null;
  expectedNetScope: number | null;
  expectedGrossMonthlyOngoing: number | null;
  recognizedGrossScope: number | null;
  recognizedNetScope: number | null;
  recognizedGrossMonthlyOngoing: number | null;
  recognizedAnnualPaceNet: number | null;
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

export interface Dashboard {
  month: string;
  monthLabel: string;
  year: number;
  discrepancies: Array<{
    id: string;
    clientName: string;
    manufacturerName: string;
    productLabel: string;
    note: string | null;
    actualAmount: number | null;
  }>;
  aum: { total: number; base: number; partnership: number };
  monthRewards: {
    scopeNet: number;
    ongoingMonthlyNet: number;
    annualPaceNet: number;
    totalNet: number;
  };
  targets: { month: TargetPeriod; year: TargetPeriod };
  manufacturers: Array<{ id: string; name: string; amount: number; percent: number }>;
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

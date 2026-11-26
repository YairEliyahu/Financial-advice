import type {
  CalculationBase,
  ManufacturerType,
  PaymentFrequency,
  ProductType,
} from './catalog.js';
import type { ScopeRateType } from './commission.rules.js';

export interface CommissionRuleRecord {
  id: string;
  productType: ProductType;
  manufacturerType: ManufacturerType;
  manufacturerId: string | null;
  scopeRateType: ScopeRateType;
  scopeRateValue: number | null;
  annualCap: number | null;
  ongoingRate: number;
  calculationBase: CalculationBase;
  paymentFrequency: PaymentFrequency;
  entersAum: boolean;
  requiresManualAmount: boolean;
}

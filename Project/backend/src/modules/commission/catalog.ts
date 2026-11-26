export const PRODUCT_TYPES = [
  'STUDY_FUND',
  'INVESTMENT_PROVIDENT_ONGOING',
  'SAVINGS',
  'SAVINGS_ONGOING',
  'RISK',
  'PENSION_TRANSFER',
  'PENSION_ONGOING',
  'PORTFOLIO_MANAGEMENT',
  'HEDGE_TRUST',
  'STRUCTURED',
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

export const MANUFACTURER_TYPES = ['INVESTMENT_HOUSE', 'INSURANCE'] as const;
export type ManufacturerType = (typeof MANUFACTURER_TYPES)[number];

export const CALCULATION_BASES = ['AUM', 'ANNUAL_DEPOSITS', 'PREMIUM'] as const;
export type CalculationBase = (typeof CALCULATION_BASES)[number];

export const PAYMENT_FREQUENCIES = ['ONE_TIME', 'ANNUAL', 'MONTHLY'] as const;
export type PaymentFrequency = (typeof PAYMENT_FREQUENCIES)[number];

export const MANUFACTURER_KEYS = ['ALTSHULER', 'PHOENIX', 'CLAL', 'HACHSHARA'] as const;
export type ManufacturerKey = (typeof MANUFACTURER_KEYS)[number];

export const PRODUCT_LABELS: Record<ProductType, string> = {
  STUDY_FUND: 'גמל השתלמות',
  INVESTMENT_PROVIDENT_ONGOING: 'גמל להשקעה שוטף',
  SAVINGS: 'חיסכון',
  SAVINGS_ONGOING: 'חיסכון שוטף',
  RISK: 'סיכונים',
  PENSION_TRANSFER: 'פנסיה ניוד צבירה',
  PENSION_ONGOING: 'פנסיה שוטף',
  PORTFOLIO_MANAGEMENT: 'ניהול תיקים',
  HEDGE_TRUST: 'תיק גידור בנאמנות',
  STRUCTURED: 'מוצרים מובנים',
};

export const MANUFACTURER_TYPE_LABELS: Record<ManufacturerType, string> = {
  INVESTMENT_HOUSE: 'בית השקעות',
  INSURANCE: 'חברת ביטוח',
};

export const CALCULATION_BASE_LABELS: Record<CalculationBase, string> = {
  AUM: 'שווי תיק',
  ANNUAL_DEPOSITS: 'הפקדות שנתיות',
  PREMIUM: 'פרמיה',
};

export function isProductType(value: string): value is ProductType {
  return (PRODUCT_TYPES as readonly string[]).includes(value);
}

export function isManufacturerType(value: string): value is ManufacturerType {
  return (MANUFACTURER_TYPES as readonly string[]).includes(value);
}

export function isCalculationBase(value: string): value is CalculationBase {
  return (CALCULATION_BASES as readonly string[]).includes(value);
}

export function isPaymentFrequency(value: string): value is PaymentFrequency {
  return (PAYMENT_FREQUENCIES as readonly string[]).includes(value);
}

export function listProducts(): Array<{ productType: ProductType; label: string }> {
  return PRODUCT_TYPES.map((productType) => ({
    productType,
    label: PRODUCT_LABELS[productType],
  }));
}

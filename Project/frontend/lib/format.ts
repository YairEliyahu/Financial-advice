export function formatIls(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('he-IL').format(value);
}

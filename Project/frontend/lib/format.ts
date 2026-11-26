const dateFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: 'Asia/Jerusalem',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const moneyFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1 });

const percentFormatter = new Intl.NumberFormat('he-IL', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return '—';
  }
  const parts = dateFormatter.formatToParts(new Date(`${day}T00:00:00Z`));
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('day')}/${pick('month')}/${pick('year')}`;
}

export function previousIsoDate(value: string): string {
  const cursor = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  return cursor.toISOString().slice(0, 10);
}

export function formatIls(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return moneyFormatter.format(value);
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('he-IL').format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${numberFormatter.format(value)}%`;
}

export function formatRate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return percentFormatter.format(value);
}

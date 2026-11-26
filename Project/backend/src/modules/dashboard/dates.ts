function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const value = parts.find((item) => item.type === type)?.value;
  if (!value) {
    throw new Error('MISSING_DATE_PART');
  }
  return value;
}

export function jerusalemToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`;
}

export function jerusalemYearMonth(now = new Date()): { year: number; month: number } {
  const today = jerusalemToday(now);
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}

export function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { start, end };
}

export function yearBounds(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
}

export type DashboardRange = 'month' | 'quarter' | 'year';

export function rangeBounds(range: DashboardRange, year: number, month: number): { start: string; end: string } {
  if (range === 'year') {
    return yearBounds(year);
  }
  if (range === 'month') {
    return monthBounds(year, month);
  }
  const startMonth = Math.floor((month - 1) / 3) * 3 + 1;
  const start = monthBounds(year, startMonth).start;
  if (startMonth + 3 > 12) {
    return { start, end: `${year + 1}-01-01` };
  }
  return { start, end: monthBounds(year, startMonth + 3).start };
}

export function rangeLabel(range: DashboardRange, year: number, month: number): string {
  if (range === 'year') {
    return String(year);
  }
  if (range === 'month') {
    return hebrewMonthLabel(year, month);
  }
  const quarter = Math.floor((month - 1) / 3) + 1;
  return `רבעון ${quarter} ${year}`;
}

export function hebrewMonthLabel(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month - 1, 15));
  return new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

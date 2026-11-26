export function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.length > 0) {
    return Number(value);
  }
  throw new Error('Expected a numeric value');
}

export function toNullableNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  return toNumber(value);
}

export function asDateString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Expected a date string');
  }
  return value.slice(0, 10);
}

export function asNullableDateString(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  return asDateString(value);
}

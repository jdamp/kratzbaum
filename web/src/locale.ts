const locale = 'de-DE';

export class InvalidDateTimeError extends Error {}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(value);
}

export function everyDays(days: number): string {
  return days === 1 ? 'Jeden Tag' : `Alle ${formatNumber(days)} Tage`;
}

export function overdueDays(days: number): string {
  return `${formatNumber(days)} ${days === 1 ? 'Tag' : 'Tage'} überfällig`;
}

export function formatInstant(value: string | Date, timeZone: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(new Date(value));
}

export function dateKey(value: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (name: string) => parts.find(item => item.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function dateTimeInput(value: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (name: string) => parts.find(item => item.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

// Interpret a datetime-local input in the configured deployment timezone.
export function inputToInstant(value: string, timeZone: string): string {
  const desired = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(desired)) throw new InvalidDateTimeError('Bitte gib ein gültiges Datum und eine gültige Uhrzeit ein.');
  let candidate = desired;
  for (let i = 0; i < 4; i++) {
    const inZone = dateTimeInput(new Date(candidate), timeZone);
    const delta = desired - Date.parse(`${inZone}:00Z`);
    if (delta === 0) return new Date(candidate).toISOString();
    candidate += delta;
  }
  throw new InvalidDateTimeError('Diese Uhrzeit gibt es in der eingestellten Zeitzone nicht. Bitte wähle eine andere Uhrzeit.');
}

export function dateOnly(value: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}

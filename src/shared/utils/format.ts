const peruLocale = 'es-PE'
const peruTimeZone = 'America/Lima'

export function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(peruLocale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: peruTimeZone,
  }).format(date)
}

export function formatDate(value?: string | null) {
  if (!value) return '-'
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = new Date(isDateOnly ? `${value}T00:00:00Z` : value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(peruLocale, {
    dateStyle: 'medium',
    timeZone: isDateOnly ? 'UTC' : peruTimeZone,
  }).format(date)
}

export function formatCurrency(value?: number | string | null, currency = 'USD') {
  if (value === null || value === undefined || value === '') return '-'
  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) return String(value)
  return new Intl.NumberFormat(peruLocale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(numericValue)
}

export function ensureLocalDateTimeSeconds(value: string) {
  if (!value) return value
  return value.length === 16 ? `${value}:00` : value
}

export function todayDateInput() {
  return peruDateTimeParts().date
}

export function nowDateTimeInput() {
  const parts = peruDateTimeParts()
  return `${parts.date}T${parts.time}`
}

function peruDateTimeParts() {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone: peruTimeZone,
    year: 'numeric',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  }
}

export function enumLabel(value?: string | null) {
  if (!value) return '-'
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function statusTone(status?: string | null) {
  if (!status) return 'slate'
  if (['ACTIVE', 'COMPLETED', 'ADMINISTERED', 'READ', 'CONFIRMED'].includes(status)) return 'emerald'
  if (['HIGH', 'CANCELLED', 'FAILED', 'PAST_DUE'].includes(status)) return 'red'
  if (['MEDIUM', 'SCHEDULED', 'TRIALING', 'UNREAD', 'PENDING', 'SKIPPED'].includes(status)) return 'amber'
  return 'slate'
}

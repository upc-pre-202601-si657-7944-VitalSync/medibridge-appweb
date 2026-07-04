import type { ReactNode } from 'react'

type EmptyStateProps = {
  action?: ReactNode
  title: string
}

export function EmptyState({ action, title }: EmptyStateProps) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {action}
    </div>
  )
}

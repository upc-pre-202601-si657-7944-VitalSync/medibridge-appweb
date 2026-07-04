import type { ReactNode } from 'react'
import { cn } from '@/shared/utils/cn'

type PanelProps = {
  children: ReactNode
  className?: string
}

export function Panel({ children, className }: PanelProps) {
  return <section className={cn('clinical-panel', className)}>{children}</section>
}

export function PanelHeader({
  action,
  eyebrow,
  title,
}: {
  action?: ReactNode
  eyebrow?: string
  title: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
      <div>
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-wide text-teal-700">{eyebrow}</p>
        ) : null}
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function PanelBody({ children, className }: PanelProps) {
  return <div className={cn('p-5', className)}>{children}</div>
}

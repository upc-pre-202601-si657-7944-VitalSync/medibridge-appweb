import type { ReactNode } from 'react'

type PageHeaderProps = {
  actions?: ReactNode
  eyebrow?: string
  title: string
}

export function PageHeader({ actions, eyebrow, title }: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-6">
      <div>
        {eyebrow ? <p className="text-sm font-bold uppercase tracking-wide text-blue-600">{eyebrow}</p> : null}
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}

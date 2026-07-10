import { cn } from '@/shared/utils/cn'

const toneClasses = {
  amber: 'bg-amber-100 text-amber-800 ring-amber-200',
  blue: 'bg-blue-100 text-blue-800 ring-blue-200',
  emerald: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  red: 'bg-rose-100 text-rose-800 ring-rose-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  teal: 'bg-blue-100 text-blue-800 ring-blue-200',
} as const

type StatusBadgeProps = {
  children: string
  className?: string
  tone?: keyof typeof toneClasses
}

export function StatusBadge({ children, className, tone = 'slate' }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-1 text-xs font-bold leading-none ring-1',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

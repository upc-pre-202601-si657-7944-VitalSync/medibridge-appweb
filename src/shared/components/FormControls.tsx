import { forwardRef, useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/shared/utils/cn'

const fieldBase =
  'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100'

type BaseFieldProps = {
  error?: string
  label: string
}

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & BaseFieldProps

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { className, error, label, ...props },
  ref,
) {
  const errorId = useId()
  const describedBy = error
    ? [props['aria-describedby'], errorId].filter(Boolean).join(' ')
    : props['aria-describedby']

  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        ref={ref}
        className={cn(fieldBase, error && 'border-rose-500', className)}
        {...props}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : props['aria-invalid']}
      />
      {error ? <span className="mt-1 block text-xs font-semibold text-rose-700" id={errorId}>{error}</span> : null}
    </label>
  )
})

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> &
  BaseFieldProps & {
    options: { label: string; value: string | number }[]
  }

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { className, error, label, options, ...props },
  ref,
) {
  const errorId = useId()
  const describedBy = error
    ? [props['aria-describedby'], errorId].filter(Boolean).join(' ')
    : props['aria-describedby']

  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <select
        ref={ref}
        className={cn(fieldBase, error && 'border-rose-500', className)}
        {...props}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : props['aria-invalid']}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="mt-1 block text-xs font-semibold text-rose-700" id={errorId}>{error}</span> : null}
    </label>
  )
})

export type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & BaseFieldProps

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(function TextareaField(
  { className, error, label, ...props },
  ref,
) {
  const errorId = useId()
  const describedBy = error
    ? [props['aria-describedby'], errorId].filter(Boolean).join(' ')
    : props['aria-describedby']

  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <textarea
        ref={ref}
        className={cn(
          'min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100',
          error && 'border-rose-500',
          className,
        )}
        {...props}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : props['aria-invalid']}
      />
      {error ? <span className="mt-1 block text-xs font-semibold text-rose-700" id={errorId}>{error}</span> : null}
    </label>
  )
})

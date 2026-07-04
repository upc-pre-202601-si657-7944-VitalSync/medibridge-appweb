export function LoadingBlock({ label = 'Cargando datos' }: { label?: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-500">
      {label}
    </div>
  )
}

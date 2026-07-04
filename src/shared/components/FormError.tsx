export function FormError({ message }: { message?: string | null }) {
  if (!message) return null

  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
      {message}
    </div>
  )
}

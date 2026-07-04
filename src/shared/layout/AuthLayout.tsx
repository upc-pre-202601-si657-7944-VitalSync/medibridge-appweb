import { Outlet } from 'react-router-dom'
import { Activity, ShieldCheck, Stethoscope } from 'lucide-react'

export function AuthLayout() {
  return (
    <main className="grid min-h-screen grid-cols-[minmax(420px,520px)_minmax(0,1fr)] bg-white">
      <section className="flex flex-col justify-between border-r border-slate-200 bg-slate-950 px-12 py-10 text-white">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-500">
            <Stethoscope className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-bold">MediBridge</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-200">Clinical Web</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-wide text-teal-200">Operacion clinica</p>
            <h1 className="text-4xl font-bold leading-tight">Gestion medica centralizada</h1>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <Activity className="mb-4 h-5 w-5 text-teal-200" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-100">Monitoreo, medicacion y citas</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <ShieldCheck className="mb-4 h-5 w-5 text-amber-200" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-100">JWT por API Gateway</p>
            </div>
          </div>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">http://localhost:8080</p>
      </section>
      <section className="flex items-center justify-center bg-[#f6f8f7] px-12">
        <Outlet />
      </section>
    </main>
  )
}

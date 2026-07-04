import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardPlus,
  CreditCard,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Pill,
  Stethoscope,
  UsersRound,
} from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { useAuth } from '@/modules/auth/useAuth'
import { getClinicalWorkspace } from '@/shared/utils/clinicalWorkspace'

const primaryNav = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { icon: UsersRound, label: 'Pacientes', to: '/patients' },
  { icon: CreditCard, label: 'Suscripcion', to: '/subscriptions' },
  { icon: MessageSquareText, label: 'Chat', to: '/chat' },
  { icon: Bell, label: 'Notificaciones', to: '/notifications' },
]

const patientNav = [
  { icon: ClipboardPlus, label: 'Vista 360', suffix: '' },
  { icon: UsersRound, label: 'Equipo', suffix: '/care-team' },
  { icon: CalendarDays, label: 'Citas', suffix: '/appointments' },
  { icon: Pill, label: 'Medicacion', suffix: '/medications' },
  { icon: HeartPulse, label: 'Salud', suffix: '/health' },
  { icon: FileText, label: 'Reportes', suffix: '/reports' },
  { icon: ChartNoAxesCombined, label: 'Analitica', suffix: '/analytics' },
]

function SidebarLink({
  icon: Icon,
  label,
  to,
}: {
  icon: typeof LayoutDashboard
  label: string
  to: string
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        [
          'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition',
          isActive ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
        ].join(' ')
      }
      to={to}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </NavLink>
  )
}

export function AppLayout() {
  const { pathname } = useLocation()
  const { signOut, user } = useAuth()
  const [workspace, setWorkspace] = useState(() => getClinicalWorkspace(user?.id))

  useEffect(() => {
    function refreshWorkspace() {
      setWorkspace(getClinicalWorkspace(user?.id))
    }

    window.addEventListener('medibridge:workspace-updated', refreshWorkspace)
    window.addEventListener('storage', refreshWorkspace)
    return () => {
      window.removeEventListener('medibridge:workspace-updated', refreshWorkspace)
      window.removeEventListener('storage', refreshWorkspace)
    }
  }, [user?.id])

  const activePatient = workspace.activePatient

  return (
    <div className="app-shell">
      <aside className="flex min-h-screen flex-col border-r border-slate-200 bg-white px-4 py-5">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-700 text-white">
            <Stethoscope className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-bold leading-none text-slate-950">MediBridge</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-teal-700">Clinical Web</p>
          </div>
        </div>

        <nav className="space-y-1">
          {primaryNav.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>

        {activePatient ? (
          <div className="mt-8 border-t border-slate-200 pt-5">
            <div className="mb-3 px-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Paciente activo</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-900">{activePatient.fullName}</p>
            </div>
            <nav className="space-y-1">
              {patientNav.map((item) => (
                <SidebarLink
                  key={item.suffix}
                  icon={item.icon}
                  label={item.label}
                  to={`/patients/${activePatient.id}${item.suffix}`}
                />
              ))}
            </nav>
          </div>
        ) : null}

        <div className="mt-auto space-y-3 border-t border-slate-200 pt-5">
          {workspace.doctorProfile ? (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Perfil medico</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-900">{workspace.doctorProfile.fullName}</p>
              <p className="text-xs font-semibold text-slate-500">Perfil activo</p>
            </div>
          ) : null}
          <Button className="w-full" onClick={signOut} variant="secondary">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Cerrar sesion
          </Button>
        </div>
      </aside>

      <main className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-8 backdrop-blur">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-teal-700" aria-hidden="true" />
            <span className="text-sm font-bold text-slate-700">{pathname}</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge tone={activePatient ? 'teal' : 'amber'}>
              {activePatient ? activePatient.fullName : 'Sin paciente'}
            </StatusBadge>
            <span className="text-sm font-semibold text-slate-600">{user?.username}</span>
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] space-y-6 px-8 py-7">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

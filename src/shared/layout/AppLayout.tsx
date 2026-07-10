import { useQuery } from '@tanstack/react-query'
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
import { profilesApi } from '@/shared/api/medibridgeApi'
import { clearActivePatient, getClinicalWorkspace } from '@/shared/utils/clinicalWorkspace'

const primaryNav = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { icon: UsersRound, label: 'Pacientes', to: '/patients' },
  { icon: Pill, label: 'Centro de medicación', to: '/medications' },
  { icon: CreditCard, label: 'Suscripción', to: '/subscriptions' },
  { icon: MessageSquareText, label: 'Chat', to: '/chat' },
  { icon: Bell, label: 'Notificaciones', to: '/notifications' },
]

const patientNav = [
  { icon: ClipboardPlus, label: 'Vista 360', suffix: '', end: true },
  { icon: UsersRound, label: 'Equipo', suffix: '/care-team' },
  { icon: CalendarDays, label: 'Citas', suffix: '/appointments' },
  { icon: Pill, label: 'Medicación', suffix: '/medications' },
  { icon: HeartPulse, label: 'Salud', suffix: '/health' },
  { icon: FileText, label: 'Reportes', suffix: '/reports' },
  { icon: ChartNoAxesCombined, label: 'Analítica', suffix: '/analytics' },
]

function getPageTitle(pathname: string) {
  if (pathname === '/dashboard') return 'Dashboard'
  if (pathname === '/onboarding/doctor') return 'Perfil médico'
  if (pathname === '/patients/new') return 'Nuevo paciente'
  if (pathname === '/patients') return 'Pacientes'
  if (pathname === '/medications') return 'Centro de medicación'
  if (pathname === '/subscriptions') return 'Suscripción'
  if (pathname === '/chat') return 'Chat'
  if (pathname === '/notifications') return 'Notificaciones'
  if (/^\/patients\/[^/]+\/care-team$/.test(pathname)) return 'Equipo de cuidado'
  if (/^\/patients\/[^/]+\/appointments$/.test(pathname)) return 'Citas'
  if (/^\/patients\/[^/]+\/medications$/.test(pathname)) return 'Medicación'
  if (/^\/patients\/[^/]+\/health$/.test(pathname)) return 'Salud'
  if (/^\/patients\/[^/]+\/reports$/.test(pathname)) return 'Reportes'
  if (/^\/patients\/[^/]+\/analytics$/.test(pathname)) return 'Analítica'
  if (/^\/patients\/[^/]+$/.test(pathname)) return 'Vista 360'
  return 'MediBridge'
}

function SidebarLink({
  end,
  icon: Icon,
  label,
  to,
}: {
  end?: boolean
  icon: typeof LayoutDashboard
  label: string
  to: string
}) {
  return (
    <NavLink
      end={end}
      className={({ isActive }) =>
        [
          'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition',
          isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white',
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
  const patientsQuery = useQuery({
    enabled: Boolean(user?.id),
    queryFn: profilesApi.listMyPatients,
    queryKey: ['my-patients', user?.id, 'workspace-validation'],
    retry: false,
  })

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

  useEffect(() => {
    const selectedPatient = workspace.activePatient
    if (!selectedPatient || !patientsQuery.isSuccess || patientsQuery.isFetching) return
    const stillAssigned = patientsQuery.data.some((patient) => patient.id === selectedPatient.id)
    if (!stillAssigned) clearActivePatient(user?.id)
  }, [patientsQuery.data, patientsQuery.isFetching, patientsQuery.isSuccess, user?.id, workspace.activePatient])

  const selectedPatient = workspace.activePatient
  const activePatient =
    selectedPatient && patientsQuery.isSuccess
      ? patientsQuery.data.find((patient) => patient.id === selectedPatient.id) ?? null
      : null
  const pageTitle = getPageTitle(pathname)

  return (
    <div className="app-shell">
      <aside className="flex min-h-screen flex-col border-r border-slate-800 bg-slate-900 px-4 py-5 text-white">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600 text-white">
            <Stethoscope className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-bold leading-none text-white">MediBridge</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-blue-200">Clinical Web</p>
          </div>
        </div>

        <nav className="space-y-1">
          {primaryNav.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>

        {activePatient ? (
          <div className="mt-8 border-t border-slate-700 pt-5">
            <div className="mb-3 px-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Paciente vinculado</p>
              <p className="mt-1 truncate text-sm font-bold text-white">{activePatient.fullName}</p>
            </div>
            <nav className="space-y-1">
              {patientNav.map((item) => (
                <SidebarLink
                  key={item.suffix}
                  end={item.end}
                  icon={item.icon}
                  label={item.label}
                  to={`/patients/${activePatient.id}${item.suffix}`}
                />
              ))}
            </nav>
          </div>
        ) : null}

        <div className="mt-auto space-y-3 border-t border-slate-700 pt-5">
          {workspace.doctorProfile ? (
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Perfil médico</p>
              <p className="mt-1 truncate text-sm font-bold text-white">{workspace.doctorProfile.fullName}</p>
              <p className="text-xs font-semibold text-slate-400">Perfil activo</p>
            </div>
          ) : null}
          <Button className="w-full" onClick={signOut} variant="secondary">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-8 backdrop-blur">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <span className="text-sm font-bold text-slate-900">{pageTitle}</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge tone={activePatient ? 'blue' : 'amber'}>
              {activePatient ? activePatient.fullName : 'Sin paciente vinculado'}
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

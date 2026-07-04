import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, CalendarDays, FileText, HeartPulse, Pill } from 'lucide-react'
import { appointmentsApi, healthApi, medicationApi, paymentsApi, reportsApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { LoadingBlock } from '@/shared/components/LoadingBlock'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { useAuth } from '@/modules/auth/useAuth'
import { getClinicalWorkspace } from '@/shared/utils/clinicalWorkspace'
import { formatDateTime } from '@/shared/utils/format'
import { enumLabel, statusTone } from '@/shared/utils/labels'

function MetricTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity
  label: string
  value: number | string
}) {
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <Icon className="h-5 w-5 text-teal-700" aria-hidden="true" />
      </div>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </Panel>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const [workspace, setWorkspace] = useState(() => getClinicalWorkspace())
  const patientId = workspace.activePatient?.id

  useEffect(() => {
    function refreshWorkspace() {
      setWorkspace(getClinicalWorkspace())
    }

    window.addEventListener('medibridge:workspace-updated', refreshWorkspace)
    return () => window.removeEventListener('medibridge:workspace-updated', refreshWorkspace)
  }, [])

  const subscriptionQuery = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => paymentsApi.getActiveSubscription(user!.id),
    queryKey: ['active-subscription', user?.id],
    retry: false,
  })
  const appointmentsQuery = useQuery({
    enabled: Boolean(patientId),
    queryFn: () => appointmentsApi.listPatientAppointments(patientId!),
    queryKey: ['appointments', patientId],
  })
  const medicationsQuery = useQuery({
    enabled: Boolean(patientId),
    queryFn: () => medicationApi.listPatientMedications(patientId!),
    queryKey: ['medications', patientId],
  })
  const alertsQuery = useQuery({
    enabled: Boolean(patientId),
    queryFn: () => healthApi.listActiveAlerts(patientId!),
    queryKey: ['alerts', patientId],
  })
  const reportsQuery = useQuery({
    enabled: Boolean(patientId),
    queryFn: () => reportsApi.listReports(patientId!),
    queryKey: ['reports', patientId],
    retry: false,
  })

  return (
    <>
      <PageHeader
        actions={
          <div className="flex gap-2">
            <Link className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50" to="/onboarding/doctor">
              Perfil medico
            </Link>
            <Link className="inline-flex h-10 items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800" to="/patients">
              Pacientes
            </Link>
          </div>
        }
        eyebrow="MediBridge Clinical"
        title="Dashboard"
      />

      <div className="grid grid-cols-5 gap-4">
        <MetricTile icon={HeartPulse} label="Alertas" value={alertsQuery.data?.length ?? '-'} />
        <MetricTile icon={CalendarDays} label="Citas" value={appointmentsQuery.data?.length ?? '-'} />
        <MetricTile icon={Pill} label="Medicamentos" value={medicationsQuery.data?.length ?? '-'} />
        <MetricTile icon={FileText} label="Reportes" value={reportsQuery.data?.length ?? '-'} />
        <Panel className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Plan</p>
          <div className="mt-3">
            {subscriptionQuery.data ? (
              <StatusBadge tone={statusTone(subscriptionQuery.data.status)}>
                {subscriptionQuery.data.plan.planType}
              </StatusBadge>
            ) : (
              <StatusBadge tone="amber">Sin plan</StatusBadge>
            )}
          </div>
        </Panel>
      </div>

      {!patientId ? (
        <Panel>
          <PanelBody>
            <EmptyState
              action={
                <Button onClick={() => window.location.assign('/patients')} size="sm">
                  Abrir pacientes
                </Button>
              }
              title="No hay paciente activo"
            />
          </PanelBody>
        </Panel>
      ) : null}

      <div className="grid grid-cols-[1fr_420px] gap-6">
        <Panel>
          <PanelHeader eyebrow="Agenda" title="Proximas citas" />
          <PanelBody>
            {appointmentsQuery.isLoading ? (
              <LoadingBlock />
            ) : appointmentsQuery.data?.length ? (
              <table className="clinical-table">
                <thead>
                  <tr>
                    <th>Inicio</th>
                    <th>Estado</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {appointmentsQuery.data.slice(0, 6).map((appointment) => (
                    <tr key={appointment.id}>
                      <td>{formatDateTime(appointment.startsAt)}</td>
                      <td>
                        <StatusBadge tone={statusTone(appointment.status)}>
                          {enumLabel(appointment.status)}
                        </StatusBadge>
                      </td>
                      <td>{appointment.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState title="Sin citas registradas" />
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Alertas" title="Activas" />
          <PanelBody>
            {alertsQuery.data?.length ? (
              <div className="space-y-3">
                {alertsQuery.data.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <StatusBadge tone={statusTone(alert.severity)}>{alert.severity}</StatusBadge>
                      <span className="text-xs font-semibold text-slate-500">{formatDateTime(alert.triggeredAt)}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{alert.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Sin alertas activas" />
            )}
          </PanelBody>
        </Panel>
      </div>
    </>
  )
}

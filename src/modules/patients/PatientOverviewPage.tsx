import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { appointmentsApi, healthApi, medicationApi, reportsApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { LoadingBlock } from '@/shared/components/LoadingBlock'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { formatDate, formatDateTime } from '@/shared/utils/format'
import { enumLabel, statusTone } from '@/shared/utils/labels'
import { PatientAccessState } from './PatientAccessState'
import { usePatientRoute } from './usePatientRoute'

export function PatientOverviewPage() {
  const { accessError, patient, patientId, patientQuery, routePatientId } = usePatientRoute()

  const appointmentsQuery = useQuery({
    enabled: Boolean(patientId),
    queryFn: () => appointmentsApi.listPatientAppointments(patientId),
    queryKey: ['appointments', patientId],
  })
  const medicationsQuery = useQuery({
    enabled: Boolean(patientId),
    queryFn: () => medicationApi.listPatientMedications(patientId),
    queryKey: ['medications', patientId],
  })
  const alertsQuery = useQuery({
    enabled: Boolean(patientId),
    queryFn: () => healthApi.listActiveAlerts(patientId),
    queryKey: ['alerts', patientId],
  })
  const summaryQuery = useQuery({
    enabled: Boolean(patientId),
    queryFn: () => healthApi.getSummary(patientId),
    queryKey: ['health-summary', patientId],
    retry: false,
  })
  const reportsQuery = useQuery({
    enabled: Boolean(patientId),
    queryFn: () => reportsApi.listReports(patientId),
    queryKey: ['reports', patientId],
    retry: false,
  })

  if (patientQuery.isLoading) return <LoadingBlock />
  if (accessError) return <PatientAccessState message={accessError} patientId={routePatientId} />

  return (
    <>
      <PageHeader
        actions={
          <Link
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            to={`/patients/${patientId}/health`}
          >
            Registrar signos
          </Link>
        }
        eyebrow="Paciente vinculado"
        title={patient?.fullName ?? 'Paciente'}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Alertas activas</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{alertsQuery.data?.length ?? '-'}</p>
        </Panel>
        <Panel className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Citas</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{appointmentsQuery.data?.length ?? '-'}</p>
        </Panel>
        <Panel className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Medicamentos</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{medicationsQuery.data?.length ?? '-'}</p>
        </Panel>
        <Panel className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Reportes</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{reportsQuery.data?.length ?? '-'}</p>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Panel>
          <PanelHeader eyebrow="Resumen clínico" title="Estado actual" />
          <PanelBody>
            {summaryQuery.data?.summary ? (
              <p className="text-sm leading-6 text-slate-700">{summaryQuery.data.summary}</p>
            ) : (
              <EmptyState title="Sin resumen clínico disponible" />
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Salud" title="Alertas" />
          <PanelBody>
            {alertsQuery.data?.length ? (
              <div className="space-y-3">
                {alertsQuery.data.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
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

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            action={
              <Button size="sm" variant="secondary" onClick={() => window.location.assign(`/patients/${patientId}/appointments`)}>
                Ver citas
              </Button>
            }
            eyebrow="Citas"
            title="Agenda"
          />
          <PanelBody>
            {appointmentsQuery.data?.length ? (
              <table className="clinical-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {appointmentsQuery.data.slice(0, 5).map((appointment) => (
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
          <PanelHeader eyebrow="Medicación" title="Medicación activa" />
          <PanelBody>
            {medicationsQuery.data?.length ? (
              <table className="clinical-table">
                <thead>
                  <tr>
                    <th>Medicamento</th>
                    <th>Dosis</th>
                    <th>Expira</th>
                  </tr>
                </thead>
                <tbody>
                  {medicationsQuery.data.slice(0, 5).map((medication) => (
                    <tr key={medication.id}>
                      <td className="font-semibold">{medication.name}</td>
                      <td>
                        {medication.dosageAmount} {medication.dosageUnit}
                      </td>
                      <td>{formatDate(medication.expirationDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState title="Sin medicación registrada" />
            )}
          </PanelBody>
        </Panel>
      </div>
    </>
  )
}

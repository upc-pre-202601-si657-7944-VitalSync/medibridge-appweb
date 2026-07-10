import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { reportsApi } from '@/shared/api/medibridgeApi'
import { EmptyState } from '@/shared/components/EmptyState'
import { LoadingBlock } from '@/shared/components/LoadingBlock'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { formatDateTime } from '@/shared/utils/format'
import { enumLabel } from '@/shared/utils/labels'
import { PatientAccessState } from '@/modules/patients/PatientAccessState'
import { usePatientRoute } from '@/modules/patients/usePatientRoute'

const trendTone = {
  DECLINING: 'red',
  IMPROVING: 'emerald',
  STABLE: 'blue',
} as const

export function AnalyticsPage() {
  const { accessError, patient, patientId, patientQuery, routePatientId } = usePatientRoute()
  const dashboardQuery = useQuery({
    enabled: Boolean(patientId),
    queryFn: () => reportsApi.getDashboard(patientId),
    queryKey: ['analytics-dashboard', patientId],
    retry: false,
  })

  if (patientQuery.isLoading) return <LoadingBlock />
  if (accessError) return <PatientAccessState message={accessError} patientId={routePatientId} />

  const chartData =
    dashboardQuery.data?.metricSnapshots.map((snapshot) => ({
      metric: enumLabel(snapshot.metricType),
      unit: snapshot.unit,
      value: Number(snapshot.value),
    })) ?? []

  return (
    <>
      <PageHeader eyebrow="Paciente vinculado" title={`Analítica - ${patient?.fullName ?? ''}`} />

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Panel>
          <PanelHeader eyebrow="Analítica" title="Métricas" />
          <PanelBody>
            {dashboardQuery.isLoading ? (
              <LoadingBlock />
            ) : chartData.length ? (
              <div className="h-[380px]">
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis dataKey="metric" tick={{ fill: '#475569', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="Sin métricas disponibles" />
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Tendencias" title="Indicadores" />
          <PanelBody>
            {dashboardQuery.data?.trendIndicators.length ? (
              <div className="space-y-3">
                {dashboardQuery.data.trendIndicators.map((trend) => (
                  <div key={trend.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="font-bold text-slate-950">{enumLabel(trend.metricType)}</p>
                      <StatusBadge tone={trendTone[trend.direction]}>{enumLabel(trend.direction)}</StatusBadge>
                    </div>
                    <p className="text-sm leading-6 text-slate-600">{trend.explanation}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Sin tendencias disponibles" />
            )}
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader eyebrow="Capturas" title="Datos capturados" />
        <PanelBody>
          {dashboardQuery.data?.metricSnapshots.length ? (
            <table className="clinical-table">
              <thead>
                <tr>
                  <th>Métrica</th>
                  <th>Valor</th>
                  <th>Unidad</th>
                  <th>Captura</th>
                </tr>
              </thead>
              <tbody>
                {dashboardQuery.data.metricSnapshots.map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td>{enumLabel(snapshot.metricType)}</td>
                    <td>{snapshot.value}</td>
                    <td>{snapshot.unit}</td>
                    <td>{formatDateTime(snapshot.capturedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="Sin snapshots disponibles" />
          )}
        </PanelBody>
      </Panel>
    </>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Download, FilePlus2 } from 'lucide-react'
import { z } from 'zod'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { reportsApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { FormError } from '@/shared/components/FormError'
import { SelectField, TextField } from '@/shared/components/FormControls'
import { LoadingBlock } from '@/shared/components/LoadingBlock'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { formatDate, formatDateTime, todayDateInput } from '@/shared/utils/format'
import { enumLabel } from '@/shared/utils/labels'
import { PatientAccessState } from '@/modules/patients/PatientAccessState'
import { usePatientRoute } from '@/modules/patients/usePatientRoute'

const reportSchema = z
  .object({
    endDate: z.string().min(1, 'Fecha fin requerida'),
    reportType: z.enum(['VITAL_SIGNS', 'MEDICATION', 'FULL_CLINICAL']),
    startDate: z.string().min(1, 'Fecha inicio requerida'),
  })
  .refine((values) => values.endDate >= values.startDate, {
    message: 'La fecha fin debe ser mayor o igual',
    path: ['endDate'],
  })

type ReportForm = z.infer<typeof reportSchema>

export function ReportsPage() {
  const { accessError, patient, patientId, patientQuery, routePatientId } = usePatientRoute()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<ReportForm>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      endDate: todayDateInput(),
      reportType: 'FULL_CLINICAL',
      startDate: todayDateInput(),
    },
  })

  const reportsQuery = useQuery({
    enabled: Boolean(patientId),
    queryFn: () => reportsApi.listReports(patientId),
    queryKey: ['reports', patientId],
    retry: false,
  })

  const generateReportMutation = useMutation({
    mutationFn: (values: ReportForm) =>
      reportsApi.generateReport({
        endDate: values.endDate,
        patientId,
        reportType: values.reportType,
        startDate: values.startDate,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reports', patientId] })
    },
  })

  const exportPdfMutation = useMutation({
    mutationFn: async (reportId: number) => {
      await reportsApi.generatePdf(reportId)
      const blob = await reportsApi.downloadPdf(reportId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `medibridge-report-${reportId}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reports', patientId] })
    },
  })

  async function submitReport(values: ReportForm) {
    setError(null)
    try {
      await generateReportMutation.mutateAsync(values)
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  async function runReportAction(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  if (patientQuery.isLoading) return <LoadingBlock />
  if (accessError) return <PatientAccessState message={accessError} patientId={routePatientId} />

  return (
    <>
      <PageHeader eyebrow="Paciente vinculado" title={`Reportes - ${patient?.fullName ?? ''}`} />
      <FormError message={error} />

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Panel>
          <PanelHeader eyebrow="Reportes" title="Generar reporte" />
          <PanelBody>
            <form className="space-y-4" onSubmit={form.handleSubmit(submitReport)}>
              <SelectField
                error={form.formState.errors.reportType?.message}
                label="Tipo"
                options={['FULL_CLINICAL', 'VITAL_SIGNS', 'MEDICATION'].map((value) => ({
                  label: enumLabel(value),
                  value,
                }))}
                {...form.register('reportType')}
              />
              <TextField error={form.formState.errors.startDate?.message} label="Inicio" type="date" {...form.register('startDate')} />
              <TextField error={form.formState.errors.endDate?.message} label="Fin" type="date" {...form.register('endDate')} />
              <Button className="w-full" isLoading={generateReportMutation.isPending} type="submit">
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                Generar
              </Button>
            </form>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Historial" title="Reportes clínicos" />
          <PanelBody>
            {reportsQuery.isLoading ? (
              <LoadingBlock />
            ) : reportsQuery.data?.length ? (
              <table className="clinical-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Tipo</th>
                    <th>Periodo</th>
                    <th>Generado</th>
                    <th>Resumen</th>
                    <th>PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {reportsQuery.data.map((report) => (
                    <tr key={report.id}>
                      <td>{report.id}</td>
                      <td>{enumLabel(report.reportType)}</td>
                      <td>
                        {formatDate(report.periodStartDate)} - {formatDate(report.periodEndDate)}
                      </td>
                      <td>{formatDateTime(report.generatedAt)}</td>
                      <td className="max-w-sm">{report.summary}</td>
                      <td>
                        <Button
                          isLoading={exportPdfMutation.isPending}
                          onClick={() => runReportAction(() => exportPdfMutation.mutateAsync(report.id))}
                          size="sm"
                          variant="secondary"
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                          PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState title="Sin reportes generados" />
            )}
          </PanelBody>
        </Panel>
      </div>
    </>
  )
}

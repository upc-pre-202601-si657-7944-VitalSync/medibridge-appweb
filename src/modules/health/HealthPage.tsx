import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { HeartPulse } from 'lucide-react'
import { z } from 'zod'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { healthApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { FormError } from '@/shared/components/FormError'
import { SelectField, TextareaField, TextField } from '@/shared/components/FormControls'
import { LoadingBlock } from '@/shared/components/LoadingBlock'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { ensureLocalDateTimeSeconds, formatDateTime, nowDateTimeInput } from '@/shared/utils/format'
import { getClinicalWorkspace } from '@/shared/utils/clinicalWorkspace'
import { enumLabel, statusTone } from '@/shared/utils/labels'
import { PatientAccessState } from '@/modules/patients/PatientAccessState'
import { usePatientRoute } from '@/modules/patients/usePatientRoute'

const observationSchema = z.object({
  bodyTemperature: z.coerce.number().min(30).max(45),
  clinicalNotes: z.string().min(3, 'Nota clinica requerida'),
  diastolicBloodPressure: z.coerce.number().int().min(30).max(180),
  emotionalNotes: z.string().optional(),
  emotionalState: z.enum(['CALM', 'ANXIOUS', 'SAD', 'IRRITABLE', 'CONFUSED', 'APATHETIC']),
  painLevel: z.coerce.number().int().min(0).max(10),
  recordedAt: z.string().min(1, 'Fecha requerida'),
  systolicBloodPressure: z.coerce.number().int().min(60).max(260),
})

type ObservationFormInput = z.input<typeof observationSchema>
type ObservationForm = z.output<typeof observationSchema>

export function HealthPage() {
  const { accessError, patient, patientId, patientQuery, routePatientId } = usePatientRoute()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const workspace = getClinicalWorkspace()
  const doctorProfile = workspace.doctorProfile
  const form = useForm<ObservationFormInput, unknown, ObservationForm>({
    resolver: zodResolver(observationSchema),
    defaultValues: {
      bodyTemperature: 36.8,
      clinicalNotes: '',
      diastolicBloodPressure: 80,
      emotionalNotes: '',
      emotionalState: 'CALM',
      painLevel: 0,
      recordedAt: nowDateTimeInput(),
      systolicBloodPressure: 120,
    },
  })

  const observationsQuery = useQuery({
    enabled: Boolean(patientId),
    queryFn: () => healthApi.listObservations(patientId),
    queryKey: ['health-observations', patientId],
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

  const recordObservationMutation = useMutation({
    mutationFn: (values: ObservationForm) => {
      if (!doctorProfile) {
        throw new Error('Completa tu perfil medico antes de registrar observaciones')
      }

      return healthApi.recordObservation(patientId, {
        ...values,
        emotionalNotes: values.emotionalNotes ?? '',
        recordedByDoctorProfileId: doctorProfile.id,
        recordedAt: ensureLocalDateTimeSeconds(values.recordedAt),
      })
    },
    onSuccess: () => {
      form.reset({
        bodyTemperature: 36.8,
        clinicalNotes: '',
        diastolicBloodPressure: 80,
        emotionalNotes: '',
        emotionalState: 'CALM',
        painLevel: 0,
        recordedAt: nowDateTimeInput(),
        systolicBloodPressure: 120,
      })
      void queryClient.invalidateQueries({ queryKey: ['health-observations', patientId] })
      void queryClient.invalidateQueries({ queryKey: ['alerts', patientId] })
      void queryClient.invalidateQueries({ queryKey: ['health-summary', patientId] })
    },
  })

  async function recordObservation(values: ObservationForm) {
    setError(null)
    try {
      await recordObservationMutation.mutateAsync(values)
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  if (patientQuery.isLoading) return <LoadingBlock />
  if (accessError) return <PatientAccessState message={accessError} patientId={routePatientId} />

  return (
    <>
      <PageHeader eyebrow="Paciente activo" title={`Monitoreo clinico - ${patient?.fullName ?? ''}`} />
      <FormError message={error} />

      <div className="grid grid-cols-[440px_1fr] gap-6">
        <Panel>
          <PanelHeader eyebrow="Health Monitoring" title="Registrar observacion" />
          <PanelBody>
            <form className="space-y-4" onSubmit={form.handleSubmit(recordObservation)}>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Medico responsable</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {doctorProfile?.fullName ?? 'Perfil medico pendiente'}
                </p>
              </div>
              <TextField error={form.formState.errors.recordedAt?.message} label="Fecha" type="datetime-local" {...form.register('recordedAt')} />
              <div className="grid grid-cols-2 gap-3">
                <TextField error={form.formState.errors.systolicBloodPressure?.message} label="Sistolica" type="number" {...form.register('systolicBloodPressure')} />
                <TextField error={form.formState.errors.diastolicBloodPressure?.message} label="Diastolica" type="number" {...form.register('diastolicBloodPressure')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField error={form.formState.errors.bodyTemperature?.message} label="Temperatura" type="number" step="0.1" {...form.register('bodyTemperature')} />
                <TextField error={form.formState.errors.painLevel?.message} label="Dolor 0-10" type="number" min={0} max={10} {...form.register('painLevel')} />
              </div>
              <SelectField
                error={form.formState.errors.emotionalState?.message}
                label="Estado emocional"
                options={['CALM', 'ANXIOUS', 'SAD', 'IRRITABLE', 'CONFUSED', 'APATHETIC'].map((value) => ({ label: enumLabel(value), value }))}
                {...form.register('emotionalState')}
              />
              <TextareaField error={form.formState.errors.emotionalNotes?.message} label="Notas emocionales" {...form.register('emotionalNotes')} />
              <TextareaField error={form.formState.errors.clinicalNotes?.message} label="Notas clinicas" {...form.register('clinicalNotes')} />
              <Button className="w-full" isLoading={recordObservationMutation.isPending} type="submit">
                <HeartPulse className="h-4 w-4" aria-hidden="true" />
                Registrar
              </Button>
            </form>
          </PanelBody>
        </Panel>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Panel>
              <PanelHeader eyebrow="Resumen" title="Resumen clinico" />
              <PanelBody>
                {summaryQuery.data?.summary ? (
                  <p className="text-sm leading-6 text-slate-700">{summaryQuery.data.summary}</p>
                ) : (
                  <EmptyState title="Sin resumen clinico disponible" />
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Alertas" title="Activas" />
              <PanelBody>
                {alertsQuery.data?.length ? (
                  <div className="space-y-3">
                    {alertsQuery.data.map((alert) => (
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

          <Panel>
            <PanelHeader eyebrow="Observaciones" title="Historial" />
            <PanelBody>
              {observationsQuery.isLoading ? (
                <LoadingBlock />
              ) : observationsQuery.data?.length ? (
                <table className="clinical-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>PA</th>
                      <th>Temp</th>
                      <th>Dolor</th>
                      <th>Estado</th>
                      <th>Nota clinica</th>
                    </tr>
                  </thead>
                  <tbody>
                    {observationsQuery.data.map((observation) => (
                      <tr key={observation.id}>
                        <td>{formatDateTime(observation.recordedAt)}</td>
                        <td>
                          {observation.systolicBloodPressure}/{observation.diastolicBloodPressure}
                        </td>
                        <td>{observation.bodyTemperature}</td>
                        <td>{observation.painLevel}</td>
                        <td>{enumLabel(observation.emotionalState)}</td>
                        <td>{observation.clinicalNotes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState title="Sin observaciones registradas" />
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  )
}

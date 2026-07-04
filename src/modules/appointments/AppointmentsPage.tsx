import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { CalendarPlus } from 'lucide-react'
import { z } from 'zod'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { appointmentsApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { FormError } from '@/shared/components/FormError'
import { TextareaField, TextField } from '@/shared/components/FormControls'
import { LoadingBlock } from '@/shared/components/LoadingBlock'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { ensureLocalDateTimeSeconds, formatDateTime, nowDateTimeInput } from '@/shared/utils/format'
import { getClinicalWorkspace } from '@/shared/utils/clinicalWorkspace'
import { enumLabel, statusTone } from '@/shared/utils/labels'
import { usePatientRoute } from '@/modules/patients/usePatientRoute'

const appointmentSchema = z.object({
  durationInMinutes: z.coerce.number().int().min(15).max(240),
  reason: z.string().min(3, 'Motivo requerido'),
  startsAt: z.string().min(1, 'Fecha requerida'),
})

type AppointmentFormInput = z.input<typeof appointmentSchema>
type AppointmentForm = z.output<typeof appointmentSchema>

export function AppointmentsPage() {
  const { patient, patientId, patientQuery } = usePatientRoute()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const workspace = getClinicalWorkspace()
  const doctorProfile = workspace.doctorProfile
  const form = useForm<AppointmentFormInput, unknown, AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      durationInMinutes: 45,
      reason: '',
      startsAt: nowDateTimeInput(),
    },
  })

  const appointmentsQuery = useQuery({
    enabled: Boolean(patientId),
    queryFn: () => appointmentsApi.listPatientAppointments(patientId),
    queryKey: ['appointments', patientId],
  })

  const createAppointmentMutation = useMutation({
    mutationFn: (values: AppointmentForm) => {
      if (!doctorProfile) {
        throw new Error('Completa tu perfil medico antes de programar citas')
      }

      return appointmentsApi.createMedicalAppointment({
        doctorProfileId: doctorProfile.id,
        durationInMinutes: values.durationInMinutes,
        patientId,
        reason: values.reason,
        startsAt: ensureLocalDateTimeSeconds(values.startsAt),
      })
    },
    onSuccess: () => {
      form.reset({
        durationInMinutes: 45,
        reason: '',
        startsAt: nowDateTimeInput(),
      })
      void queryClient.invalidateQueries({ queryKey: ['appointments', patientId] })
    },
  })

  async function createAppointment(values: AppointmentForm) {
    setError(null)
    try {
      await createAppointmentMutation.mutateAsync(values)
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  if (patientQuery.isLoading) return <LoadingBlock />

  return (
    <>
      <PageHeader eyebrow="Paciente activo" title={`Citas medicas - ${patient?.fullName ?? ''}`} />
      <div className="grid grid-cols-[420px_1fr] gap-6">
        <Panel>
          <PanelHeader eyebrow="Appointments" title="Nueva cita" />
          <PanelBody>
            <form className="space-y-4" onSubmit={form.handleSubmit(createAppointment)}>
              <FormError message={error} />
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Medico responsable</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {doctorProfile?.fullName ?? 'Perfil medico pendiente'}
                </p>
              </div>
              <TextField
                error={form.formState.errors.startsAt?.message}
                label="Inicio"
                type="datetime-local"
                {...form.register('startsAt')}
              />
              <TextField
                error={form.formState.errors.durationInMinutes?.message}
                label="Duracion minutos"
                type="number"
                {...form.register('durationInMinutes')}
              />
              <TextareaField
                error={form.formState.errors.reason?.message}
                label="Motivo"
                {...form.register('reason')}
              />
              <Button className="w-full" isLoading={createAppointmentMutation.isPending} type="submit">
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                Programar
              </Button>
            </form>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Agenda" title="Citas del paciente" />
          <PanelBody>
            {appointmentsQuery.isLoading ? (
              <LoadingBlock />
            ) : appointmentsQuery.data?.length ? (
              <table className="clinical-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {appointmentsQuery.data.map((appointment) => (
                    <tr key={appointment.id}>
                      <td>{appointment.id}</td>
                      <td>{formatDateTime(appointment.startsAt)}</td>
                      <td>{formatDateTime(appointment.endsAt)}</td>
                      <td>{enumLabel(appointment.appointmentType)}</td>
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
      </div>
    </>
  )
}

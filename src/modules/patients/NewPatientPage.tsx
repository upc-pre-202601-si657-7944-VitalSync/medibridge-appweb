import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { profilesApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { FormError } from '@/shared/components/FormError'
import { TextField } from '@/shared/components/FormControls'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { getClinicalWorkspace, saveActivePatient } from '@/shared/utils/clinicalWorkspace'

const patientSchema = z.object({
  fullName: z.string().min(3, 'Nombre requerido'),
})

type PatientForm = z.infer<typeof patientSchema>

export function NewPatientPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const doctorProfile = getClinicalWorkspace().doctorProfile
  const form = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
    defaultValues: { fullName: '' },
  })

  const createPatientMutation = useMutation({
    mutationFn: profilesApi.createAssignedPatient,
  })

  async function createPatient(values: PatientForm) {
    setError(null)
    if (!doctorProfile) {
      setError('Completa tu perfil medico antes de crear pacientes')
      return
    }

    try {
      const patient = await createPatientMutation.mutateAsync(values)
      await queryClient.invalidateQueries({ queryKey: ['my-patients'] })
      saveActivePatient(patient)
      navigate(`/patients/${patient.id}`)
    } catch (submitError) {
      setError(`No se pudo crear y vincular el paciente. ${getApiErrorMessage(submitError)}`)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Profiles" title="Nuevo paciente" />
      <div className="max-w-2xl">
        <Panel>
          <PanelHeader eyebrow="Perfil de paciente" title="Crear paciente" />
          <PanelBody>
            <form className="space-y-4" onSubmit={form.handleSubmit(createPatient)}>
              <FormError message={error} />
              {error ? (
                <p className="text-sm font-semibold text-slate-600">
                  La creacion atomica requiere acceso institucional valido.{' '}
                  <Link className="font-bold text-teal-700 underline underline-offset-2" to="/subscriptions">
                    Revisar suscripcion
                  </Link>
                </p>
              ) : null}
              <TextField
                error={form.formState.errors.fullName?.message}
                label="Nombre completo"
                {...form.register('fullName')}
              />
              <div className="flex justify-end gap-2">
                <Button onClick={() => navigate('/patients')} type="button" variant="secondary">
                  Cancelar
                </Button>
                <Button isLoading={createPatientMutation.isPending} type="submit">
                  Crear y vincular paciente
                </Button>
              </div>
            </form>
          </PanelBody>
        </Panel>
      </div>
    </>
  )
}

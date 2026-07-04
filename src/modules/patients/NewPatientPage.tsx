import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
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
  const [error, setError] = useState<string | null>(null)
  const [assignmentError, setAssignmentError] = useState<string | null>(null)
  const form = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
    defaultValues: { fullName: '' },
  })

  const createPatientMutation = useMutation({
    mutationFn: profilesApi.createPatient,
  })

  async function createPatient(values: PatientForm) {
    setError(null)
    setAssignmentError(null)
    try {
      const patient = await createPatientMutation.mutateAsync(values)
      saveActivePatient(patient)

      const doctorProfile = getClinicalWorkspace().doctorProfile
      if (doctorProfile) {
        try {
          await profilesApi.assignDoctor(patient.id, doctorProfile.id)
        } catch (assignError) {
          setAssignmentError(getApiErrorMessage(assignError))
        }
      }

      navigate(`/patients/${patient.id}`)
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
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
              <FormError message={error || assignmentError} />
              <TextField
                error={form.formState.errors.fullName?.message}
                label="Nombre completo"
                {...form.register('fullName')}
              />
              <div className="flex justify-end gap-2">
                <Button onClick={() => navigate('/patients')} variant="secondary">
                  Cancelar
                </Button>
                <Button isLoading={createPatientMutation.isPending} type="submit">
                  Crear paciente
                </Button>
              </div>
            </form>
          </PanelBody>
        </Panel>
      </div>
    </>
  )
}

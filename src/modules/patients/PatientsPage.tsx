import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { z } from 'zod'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { profilesApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { FormError } from '@/shared/components/FormError'
import { TextField } from '@/shared/components/FormControls'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { getClinicalWorkspace, saveActivePatient } from '@/shared/utils/clinicalWorkspace'

const loadPatientSchema = z.object({
  patientId: z.coerce.number().int().positive('Numero requerido'),
})

type LoadPatientFormInput = z.input<typeof loadPatientSchema>
type LoadPatientForm = z.output<typeof loadPatientSchema>

export function PatientsPage() {
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState(() => getClinicalWorkspace())
  const [error, setError] = useState<string | null>(null)
  const form = useForm<LoadPatientFormInput, unknown, LoadPatientForm>({
    resolver: zodResolver(loadPatientSchema),
    defaultValues: { patientId: workspace.activePatient?.id ?? 0 },
  })

  useEffect(() => {
    function refreshWorkspace() {
      setWorkspace(getClinicalWorkspace())
    }

    window.addEventListener('medibridge:workspace-updated', refreshWorkspace)
    return () => window.removeEventListener('medibridge:workspace-updated', refreshWorkspace)
  }, [])

  const loadPatientMutation = useMutation({
    mutationFn: profilesApi.getPatient,
    onSuccess: (patient) => {
      saveActivePatient(patient)
      navigate(`/patients/${patient.id}`)
    },
  })

  async function loadPatient(values: LoadPatientForm) {
    setError(null)
    try {
      await loadPatientMutation.mutateAsync(values.patientId)
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  return (
    <>
      <PageHeader
        actions={
          <Link
            className="inline-flex h-10 items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800"
            to="/patients/new"
          >
            Nuevo paciente
          </Link>
        }
        eyebrow="Profiles"
        title="Pacientes"
      />
      <FormError message={error} />

      <div className="grid grid-cols-[380px_1fr] gap-6">
        <Panel>
          <PanelHeader eyebrow="Busqueda" title="Abrir paciente existente" />
          <PanelBody>
            <form className="space-y-4" onSubmit={form.handleSubmit(loadPatient)}>
              <TextField
                error={form.formState.errors.patientId?.message}
                label="Numero de paciente"
                type="number"
                {...form.register('patientId')}
              />
              <Button className="w-full" isLoading={loadPatientMutation.isPending} type="submit">
                <Search className="h-4 w-4" aria-hidden="true" />
                Abrir
              </Button>
            </form>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Local" title="Pacientes recientes" />
          <PanelBody>
            {workspace.knownPatients.length ? (
              <table className="clinical-table">
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Nombre</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.knownPatients.map((patient) => (
                    <tr key={patient.id}>
                      <td>{patient.id}</td>
                      <td className="font-semibold">{patient.fullName}</td>
                      <td>
                        <Button onClick={() => navigate(`/patients/${patient.id}`)} size="sm" variant="secondary">
                          Abrir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                action={
                  <Button onClick={() => navigate('/patients/new')} size="sm">
                    Nuevo paciente
                  </Button>
                }
                title="No hay pacientes recientes"
              />
            )}
          </PanelBody>
        </Panel>
      </div>
    </>
  )
}

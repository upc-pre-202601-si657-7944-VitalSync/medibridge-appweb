import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { Search, UserRoundPlus } from 'lucide-react'
import { z } from 'zod'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { profilesApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { FormError } from '@/shared/components/FormError'
import { TextField } from '@/shared/components/FormControls'
import { LoadingBlock } from '@/shared/components/LoadingBlock'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { saveActivePatient } from '@/shared/utils/clinicalWorkspace'

const loadPatientSchema = z.object({
  patientId: z.coerce.number().int().positive('Numero requerido'),
})

type LoadPatientFormInput = z.input<typeof loadPatientSchema>
type LoadPatientForm = z.output<typeof loadPatientSchema>

export function PatientsPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const form = useForm<LoadPatientFormInput, unknown, LoadPatientForm>({
    resolver: zodResolver(loadPatientSchema),
    defaultValues: { patientId: 0 },
  })

  const patientsQuery = useQuery({
    queryFn: profilesApi.listMyPatients,
    queryKey: ['my-patients'],
    retry: false,
  })

  const visiblePatients = useMemo(() => {
    const patients = patientsQuery.data ?? []
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return patients
    return patients.filter((patient) => patient.fullName.toLowerCase().includes(normalizedSearch))
  }, [patientsQuery.data, searchTerm])

  const loadPatientMutation = useMutation({
    mutationFn: profilesApi.getPatient,
    onSuccess: (patient) => {
      saveActivePatient(patient)
      navigate(`/patients/${patient.id}`)
    },
  })

  function openPatient(patientId: number) {
    const patient = patientsQuery.data?.find((item) => item.id === patientId)
    if (patient) {
      saveActivePatient(patient)
    }
    navigate(`/patients/${patientId}`)
  }

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
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800"
            to="/patients/new"
          >
            <UserRoundPlus className="h-4 w-4" aria-hidden="true" />
            Nuevo paciente
          </Link>
        }
        eyebrow="Profiles"
        title="Pacientes"
      />
      <FormError message={error} />

      <div className="grid grid-cols-[1fr_340px] gap-6">
        <Panel>
          <PanelHeader eyebrow="Equipo de cuidado" title="Mis pacientes" />
          <PanelBody className="space-y-4">
            <TextField
              label="Buscar por nombre"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Ej. Maria Perez"
              value={searchTerm}
            />

            {patientsQuery.isLoading ? (
              <LoadingBlock />
            ) : visiblePatients.length ? (
              <table className="clinical-table">
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Codigo</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePatients.map((patient) => (
                    <tr key={patient.id}>
                      <td className="font-semibold">{patient.fullName}</td>
                      <td>{patient.id}</td>
                      <td>
                        <Button onClick={() => openPatient(patient.id)} size="sm" variant="secondary">
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
                title={patientsQuery.data?.length ? 'Sin resultados' : 'Aun no tienes pacientes asignados'}
              />
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Acceso rapido" title="Abrir por codigo" />
          <PanelBody>
            <form className="space-y-4" onSubmit={form.handleSubmit(loadPatient)}>
              <TextField
                error={form.formState.errors.patientId?.message}
                label="Codigo de paciente"
                type="number"
                {...form.register('patientId')}
              />
              <Button className="w-full" isLoading={loadPatientMutation.isPending} type="submit" variant="secondary">
                <Search className="h-4 w-4" aria-hidden="true" />
                Abrir
              </Button>
            </form>
          </PanelBody>
        </Panel>
      </div>
    </>
  )
}

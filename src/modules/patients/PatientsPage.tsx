import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, UserRoundPlus } from 'lucide-react'
import { useDebounce } from '@/shared/utils/useDebounce'
import { profilesApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { TextField } from '@/shared/components/FormControls'
import { LoadingBlock } from '@/shared/components/LoadingBlock'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { saveActivePatient } from '@/shared/utils/clinicalWorkspace'

export function PatientsPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const debouncedCode = useDebounce(codeInput, 500)

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

  const parsedCode = Number(debouncedCode)
  const validCode = Number.isInteger(parsedCode) && parsedCode > 0

  const patientByCodeQuery = useQuery({
    enabled: validCode,
    queryFn: () => profilesApi.getPatient(parsedCode),
    queryKey: ['patient-lookup', parsedCode],
    retry: false,
  })

  function openPatient(patientId: number) {
    const patient = patientsQuery.data?.find((item) => item.id === patientId) ?? patientByCodeQuery.data
    if (patient) saveActivePatient(patient)
    navigate(`/patients/${patientId}`)
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
          <PanelBody className="space-y-4">
            <TextField
              label="Codigo de paciente"
              onChange={(e) => setCodeInput(e.target.value)}
              type="number"
              value={codeInput}
            />
            {codeInput && !validCode ? (
              <p className="text-xs font-semibold text-rose-600">Ingresa un numero valido</p>
            ) : patientByCodeQuery.isFetching ? (
              <LoadingBlock />
            ) : patientByCodeQuery.data ? (
              <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Paciente encontrado</p>
                <p className="mt-1 font-bold text-slate-900">{patientByCodeQuery.data.fullName}</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">Codigo #{patientByCodeQuery.data.id}</p>
                <Button
                  className="mt-3 w-full"
                  onClick={() => openPatient(patientByCodeQuery.data.id)}
                  size="sm"
                  variant="secondary"
                >
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  Abrir paciente
                </Button>
              </div>
            ) : patientByCodeQuery.isError ? (
              <p className="text-xs font-semibold text-rose-600">No se encontro un paciente con ese codigo</p>
            ) : null}
          </PanelBody>
        </Panel>
      </div>
    </>
  )
}

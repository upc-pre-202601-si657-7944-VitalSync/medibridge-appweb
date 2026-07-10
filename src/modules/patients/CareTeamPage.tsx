import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { profilesApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { FormError } from '@/shared/components/FormError'
import { LoadingBlock } from '@/shared/components/LoadingBlock'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { getClinicalWorkspace, saveActivePatient } from '@/shared/utils/clinicalWorkspace'
import { PatientAccessState } from './PatientAccessState'

export function CareTeamPage() {
  const params = useParams()
  const patientId = Number(params.patientId)
  const validPatientId = Number.isInteger(patientId) && patientId > 0
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [confirmedPatientId, setConfirmedPatientId] = useState<number | null>(null)
  const doctorProfile = getClinicalWorkspace().doctorProfile

  const patientsQuery = useQuery({
    enabled: validPatientId,
    queryFn: profilesApi.listMyPatients,
    queryKey: ['my-patients'],
    retry: false,
  })
  const publicPatientQuery = useQuery({
    enabled: validPatientId,
    queryFn: () => profilesApi.getPatient(patientId),
    queryKey: ['patient-lookup', patientId],
    retry: false,
  })

  const assignedPatient = patientsQuery.data?.find((patient) => patient.id === patientId)
  const patient = assignedPatient ?? publicPatientQuery.data
  const isAssigned = Boolean(assignedPatient) || confirmedPatientId === patientId

  useEffect(() => {
    setConfirmedPatientId(null)
    setError(null)
    setSuccessMessage(null)
  }, [patientId])

  useEffect(() => {
    if (isAssigned && patient) saveActivePatient(patient)
  }, [isAssigned, patient])

  const assignDoctorMutation = useMutation({
    mutationFn: () => {
      if (!doctorProfile) {
        throw new Error('Completa tu perfil medico antes de asignarte pacientes')
      }
      return profilesApi.assignDoctor(patientId, doctorProfile.id)
    },
  })

  async function assignDoctor() {
    if (!patient || isAssigned) return
    setError(null)
    setSuccessMessage(null)
    try {
      const assignment = await assignDoctorMutation.mutateAsync()
      setConfirmedPatientId(patientId)
      await queryClient.invalidateQueries({ queryKey: ['my-patients'] })
      saveActivePatient(patient)
      setSuccessMessage(`Paciente vinculado correctamente mediante la asignacion #${assignment.id}.`)
    } catch (submitError) {
      setError(
        `No se pudo vincular el paciente a tu equipo. Revisa tu suscripcion institucional e intenta nuevamente. ${getApiErrorMessage(submitError)}`,
      )
    }
  }

  if (!validPatientId) {
    return <PatientAccessState message="El codigo de paciente de la ruta no es valido." />
  }
  if (patientsQuery.isLoading || publicPatientQuery.isLoading) return <LoadingBlock />
  if (!patient) {
    return (
      <PatientAccessState
        message={`No se pudo encontrar el paciente solicitado. ${publicPatientQuery.isError ? getApiErrorMessage(publicPatientQuery.error) : ''}`}
      />
    )
  }

  const relationLoadError = patientsQuery.isError
    ? `No se pudo comprobar si el paciente ya pertenece a tu equipo. ${getApiErrorMessage(patientsQuery.error)}`
    : null

  return (
    <>
      <PageHeader
        eyebrow={isAssigned ? 'Paciente activo' : 'Vinculacion pendiente'}
        title={`Equipo de cuidado - ${patient.fullName}`}
      />
      <div className="grid grid-cols-[420px_1fr] gap-6">
        <Panel>
          <PanelHeader eyebrow="Profiles" title={isAssigned ? 'Relacion activa' : 'Asignar medico'} />
          <PanelBody className="space-y-4">
            <FormError message={error || relationLoadError} />
            {successMessage ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                {successMessage}
              </div>
            ) : null}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Medico</p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {doctorProfile?.fullName ?? 'Perfil medico pendiente'}
              </p>
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Paciente</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{patient.fullName}</p>
            </div>
            <Button
              className="w-full"
              disabled={!doctorProfile || isAssigned || Boolean(relationLoadError)}
              isLoading={assignDoctorMutation.isPending}
              onClick={assignDoctor}
              type="button"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {isAssigned ? 'Paciente ya vinculado' : 'Vincularme a este paciente'}
            </Button>
            {!isAssigned ? (
              <p className="text-xs font-semibold leading-5 text-slate-600">
                La vinculacion puede requerir una suscripcion institucional activa.{' '}
                <Link className="font-bold text-teal-700 underline underline-offset-2" to="/subscriptions">
                  Revisar suscripcion
                </Link>
              </p>
            ) : null}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Acceso" title="Estado de relacion clinica" />
          <PanelBody>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
              <div>
                <p className="font-bold text-slate-950">Doctor y paciente</p>
                <p className="text-sm font-semibold text-slate-600">
                  {isAssigned
                    ? 'La relacion esta activa para citas, salud, medicacion y seguimiento.'
                    : 'Todavia no existe una relacion clinica activa con este paciente.'}
                </p>
              </div>
              <StatusBadge tone={isAssigned ? 'emerald' : 'amber'}>
                {isAssigned ? 'VINCULADO' : 'SIN VINCULAR'}
              </StatusBadge>
            </div>
          </PanelBody>
        </Panel>
      </div>
    </>
  )
}

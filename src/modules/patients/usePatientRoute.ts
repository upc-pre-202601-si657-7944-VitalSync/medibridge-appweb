import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { profilesApi } from '@/shared/api/medibridgeApi'
import { saveActivePatient } from '@/shared/utils/clinicalWorkspace'

export function usePatientRoute() {
  const params = useParams()
  const routePatientId = Number(params.patientId)
  const enabled = Number.isInteger(routePatientId) && routePatientId > 0

  const patientQuery = useQuery({
    enabled,
    queryFn: profilesApi.listMyPatients,
    queryKey: ['my-patients'],
    retry: false,
  })

  const patient = patientQuery.data?.find((item) => item.id === routePatientId)
  const isAuthorized = Boolean(patient)
  const accessError = !enabled
    ? 'El codigo de paciente de la ruta no es valido.'
    : patientQuery.isError
      ? `No se pudo verificar tu acceso al paciente. ${getApiErrorMessage(patientQuery.error)}`
      : patientQuery.isSuccess && !patient
        ? 'Este paciente no pertenece a tu equipo de cuidado. Vinculate antes de abrir su informacion clinica.'
        : null

  useEffect(() => {
    if (patient) {
      saveActivePatient(patient)
    }
  }, [patient])

  return {
    accessError,
    isAuthorized,
    patient,
    patientId: isAuthorized ? routePatientId : 0,
    patientQuery,
    routePatientId,
  }
}

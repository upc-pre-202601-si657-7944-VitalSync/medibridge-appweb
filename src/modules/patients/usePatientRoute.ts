import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { profilesApi } from '@/shared/api/medibridgeApi'
import { saveActivePatient } from '@/shared/utils/clinicalWorkspace'

export function usePatientRoute() {
  const params = useParams()
  const patientId = Number(params.patientId)
  const enabled = Number.isFinite(patientId) && patientId > 0

  const patientQuery = useQuery({
    enabled,
    queryFn: () => profilesApi.getPatient(patientId),
    queryKey: ['patient', patientId],
  })

  useEffect(() => {
    if (patientQuery.data) {
      saveActivePatient(patientQuery.data)
    }
  }, [patientQuery.data])

  return {
    patient: patientQuery.data,
    patientId,
    patientQuery,
  }
}

import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { profilesApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { FormError } from '@/shared/components/FormError'
import { LoadingBlock } from '@/shared/components/LoadingBlock'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { getClinicalWorkspace } from '@/shared/utils/clinicalWorkspace'
import { usePatientRoute } from './usePatientRoute'

export function CareTeamPage() {
  const { patient, patientId, patientQuery } = usePatientRoute()
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const doctorProfile = getClinicalWorkspace().doctorProfile

  const assignDoctorMutation = useMutation({
    mutationFn: () => {
      if (!doctorProfile) {
        throw new Error('Completa tu perfil medico antes de asignarte pacientes')
      }

      return profilesApi.assignDoctor(patientId, doctorProfile.id)
    },
  })

  async function assignDoctor() {
    setError(null)
    setSuccessMessage(null)
    try {
      const assignment = await assignDoctorMutation.mutateAsync()
      setSuccessMessage(`Relacion clinica activa desde la asignacion ${assignment.id}`)
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  if (patientQuery.isLoading) return <LoadingBlock />

  return (
    <>
      <PageHeader eyebrow="Paciente activo" title={`Equipo de cuidado - ${patient?.fullName ?? ''}`} />
      <div className="grid grid-cols-[420px_1fr] gap-6">
        <Panel>
          <PanelHeader eyebrow="Profiles" title="Asignar medico" />
          <PanelBody className="space-y-4">
            <FormError message={error} />
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
              <p className="mt-1 text-sm font-bold text-slate-900">{patient?.fullName ?? 'Paciente activo'}</p>
            </div>
            <Button
              className="w-full"
              disabled={!doctorProfile}
              isLoading={assignDoctorMutation.isPending}
              onClick={assignDoctor}
              type="button"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Asignarme a este paciente
            </Button>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Acceso" title="Estado de relacion clinica" />
          <PanelBody className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
              <div>
                <p className="font-bold text-slate-950">Doctor y paciente</p>
                <p className="text-sm font-semibold text-slate-600">
                  La asignacion queda registrada para citas, salud y seguimiento.
                </p>
              </div>
              <StatusBadge tone="emerald">PUBLICO</StatusBadge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
              <div>
                <p className="font-bold text-slate-950">Suscripcion institucional</p>
                <p className="text-sm font-semibold text-slate-600">
                  El backend exige una suscripcion activa para crear asignaciones.
                </p>
              </div>
              <StatusBadge tone="amber">REQUERIDA</StatusBadge>
            </div>
          </PanelBody>
        </Panel>
      </div>
    </>
  )
}

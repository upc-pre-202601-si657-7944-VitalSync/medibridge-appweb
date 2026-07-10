import { Link } from 'react-router-dom'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'

export function PatientAccessState({
  message,
  patientId,
}: {
  message: string
  patientId?: number
}) {
  const canRequestLink = Number.isInteger(patientId) && Number(patientId) > 0

  return (
    <>
      <PageHeader eyebrow="Acceso clinico" title="Paciente no disponible" />
      <div className="max-w-2xl">
        <Panel>
          <PanelHeader eyebrow="Equipo de cuidado" title="Vinculacion requerida" />
          <PanelBody className="space-y-4">
            <p className="text-sm font-semibold leading-6 text-slate-700">{message}</p>
            <div className="flex flex-wrap gap-2">
              {canRequestLink ? (
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800"
                  to={`/patients/${patientId}/care-team`}
                >
                  Revisar vinculacion
                </Link>
              ) : null}
              <Link
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                to="/patients"
              >
                Volver a pacientes
              </Link>
            </div>
          </PanelBody>
        </Panel>
      </div>
    </>
  )
}

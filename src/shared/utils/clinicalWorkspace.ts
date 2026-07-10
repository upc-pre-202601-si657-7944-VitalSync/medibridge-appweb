import type { DoctorProfile, PatientProfile } from '@/shared/types/api'

type ClinicalWorkspace = {
  userId?: number
  doctorProfile?: DoctorProfile
  activePatient?: PatientProfile
  knownPatients: PatientProfile[]
}

const workspaceKey = 'medibridge.clinicalWorkspace'

const defaultWorkspace: ClinicalWorkspace = {
  knownPatients: [],
}

export function getClinicalWorkspace(userId?: number) {
  const rawValue = localStorage.getItem(workspaceKey)
  if (!rawValue) return defaultWorkspace

  try {
    const parsed = JSON.parse(rawValue) as ClinicalWorkspace
    const workspace = {
      ...defaultWorkspace,
      ...parsed,
      knownPatients: parsed.knownPatients ?? [],
    }

    const ownerId = workspace.userId ?? workspace.doctorProfile?.userId
    if (userId && ownerId && ownerId !== userId) {
      return defaultWorkspace
    }

    return workspace
  } catch {
    localStorage.removeItem(workspaceKey)
    return defaultWorkspace
  }
}

function saveWorkspace(workspace: ClinicalWorkspace) {
  localStorage.setItem(workspaceKey, JSON.stringify(workspace))
  window.dispatchEvent(new Event('medibridge:workspace-updated'))
}

export function saveDoctorProfile(doctorProfile: DoctorProfile) {
  saveWorkspace({
    ...getClinicalWorkspace(doctorProfile.userId),
    userId: doctorProfile.userId,
    doctorProfile,
  })
}

export function hasCompleteDoctorProfile(workspace: ClinicalWorkspace, userId?: number) {
  const doctorProfile = workspace.doctorProfile
  return Boolean(
    doctorProfile?.id
      && doctorProfile.fullName?.trim()
      && (!userId || doctorProfile.userId === userId),
  )
}

export function saveActivePatient(patient: PatientProfile) {
  const workspace = getClinicalWorkspace()
  const knownPatients = [
    patient,
    ...workspace.knownPatients.filter((item) => item.id !== patient.id),
  ].slice(0, 12)

  saveWorkspace({
    ...workspace,
    activePatient: patient,
    knownPatients,
  })
}

export function clearActivePatient(userId?: number) {
  const workspace = getClinicalWorkspace(userId)
  if (!workspace.activePatient) return

  saveWorkspace({
    ...workspace,
    activePatient: undefined,
  })
}

export function clearClinicalWorkspace() {
  localStorage.removeItem(workspaceKey)
  window.dispatchEvent(new Event('medibridge:workspace-updated'))
}

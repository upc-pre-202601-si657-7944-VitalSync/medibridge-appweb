import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  PackagePlus,
  Pencil,
  Pill,
  Save,
  Syringe,
  Trash2,
  XCircle,
} from 'lucide-react'
import { z } from 'zod'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { medicationApi, profilesApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { FormError } from '@/shared/components/FormError'
import { SelectField, TextareaField, TextField } from '@/shared/components/FormControls'
import { LoadingBlock } from '@/shared/components/LoadingBlock'
import { Modal } from '@/shared/components/Modal'
import { Panel, PanelBody } from '@/shared/components/Panel'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { PatientAccessState } from '@/modules/patients/PatientAccessState'
import { saveActivePatient } from '@/shared/utils/clinicalWorkspace'
import { ensureLocalDateTimeSeconds, formatDate, nowDateTimeInput, todayDateInput } from '@/shared/utils/format'
import { enumLabel } from '@/shared/utils/labels'
import type { Medication, MedicationSchedule, PatientProfile } from '@/shared/types/api'

const medicationSchema = z.object({
  administrationRoute: z.enum(['ORAL', 'IV', 'IM', 'SUBCUTANEOUS', 'TOPICAL']),
  dosageAmount: z.coerce.number().positive('Dosis requerida'),
  dosageUnit: z.enum(['MG', 'ML', 'TABLET', 'CAPSULE', 'DROP', 'UNIT']),
  expirationDate: z.string().min(1, 'Fecha requerida'),
  lowStockThreshold: z.coerce.number().int().min(0),
  name: z.string().min(2, 'Nombre requerido'),
  stockQuantity: z.coerce.number().int().min(0),
})

const scheduleSchema = z.object({
  administrationTime: z.string().min(1, 'Hora requerida'),
  endDate: z.string().optional(),
  frequencyType: z.enum(['DAILY', 'TWICE_DAILY', 'WEEKLY', 'AS_NEEDED']),
  medicationId: z.coerce.number().int().positive('Medicamento requerido'),
  startDate: z.string().min(1, 'Inicio requerido'),
  timesPerDay: z.coerce.number().int().min(1).max(12),
})

const doseSchema = z.object({
  medicationId: z.coerce.number().int().positive('Medicamento requerido'),
  notes: z.string().optional(),
  occurredAt: z.string().min(1, 'Fecha requerida'),
  scheduleId: z.coerce.number().int().positive('Horario requerido'),
})

type MedicationFormInput = z.input<typeof medicationSchema>
type MedicationForm = z.output<typeof medicationSchema>
type ScheduleFormInput = z.input<typeof scheduleSchema>
type ScheduleForm = z.output<typeof scheduleSchema>
type DoseFormInput = z.input<typeof doseSchema>
type DoseForm = z.output<typeof doseSchema>
type SetupStep = 'medication' | 'treatment'
type MedicationMode = 'existing' | 'new'

type MedicationWithPatient = {
  medication: Medication
  patient: PatientProfile
}

type ScheduleWithContext = {
  medication: Medication
  patient: PatientProfile
  schedule: MedicationSchedule
}

const dosageUnitOptions = ['MG', 'ML', 'TABLET', 'CAPSULE', 'DROP', 'UNIT'].map((value) => ({
  label: value,
  value,
}))

const routeOptions = ['ORAL', 'IV', 'IM', 'SUBCUTANEOUS', 'TOPICAL'].map((value) => ({
  label: enumLabel(value),
  value,
}))

const frequencyOptions = ['DAILY', 'TWICE_DAILY', 'WEEKLY', 'AS_NEEDED'].map((value) => ({
  label: enumLabel(value),
  value,
}))

const setupSteps: { id: SetupStep; label: string; number: string }[] = [
  { id: 'medication', label: 'Medicamento', number: '01' },
  { id: 'treatment', label: 'Tratamiento', number: '02' },
]

const blueButtonClass = 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-600'
const blueSecondaryButtonClass = 'focus-visible:ring-blue-600'

function MedicationSectionHeader({
  action,
  eyebrow,
  title,
}: {
  action?: ReactNode
  eyebrow?: string
  title: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
      <div>
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-blue-600">{eyebrow}</p>
        ) : null}
        <h2 className="mt-0.5 text-base font-black text-slate-950">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function medicationDefaultValues(): MedicationFormInput {
  return {
    administrationRoute: 'ORAL',
    dosageAmount: 1,
    dosageUnit: 'MG',
    expirationDate: todayDateInput(),
    lowStockThreshold: 5,
    name: '',
    stockQuantity: 0,
  }
}

function scheduleDefaultValues(medicationId = 0): ScheduleFormInput {
  return {
    administrationTime: '08:00',
    endDate: '',
    frequencyType: 'DAILY',
    medicationId,
    startDate: todayDateInput(),
    timesPerDay: 1,
  }
}

function doseDefaultValues(medicationId = 0, scheduleId = 0): DoseFormInput {
  return {
    medicationId,
    notes: '',
    occurredAt: nowDateTimeInput(),
    scheduleId,
  }
}

function upsertById<T extends { id: number }>(items: T[], item?: T | null) {
  if (!item) return items
  const map = new Map(items.map((value) => [value.id, value]))
  map.set(item.id, item)
  return [...map.values()]
}

function formatTreatmentTime(value: string) {
  return value.slice(0, 5)
}

export function MedicationPage() {
  const params = useParams()
  const isPatientRoute = params.patientId !== undefined
  const routePatientId = Number(params.patientId)
  const hasRoutePatient = Number.isFinite(routePatientId) && routePatientId > 0
  const queryClient = useQueryClient()
  const [activeStep, setActiveStep] = useState<SetupStep>('medication')
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)
  const [doseActionScheduleId, setDoseActionScheduleId] = useState<number | null>(null)
  const [doseError, setDoseError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [editingMedicationId, setEditingMedicationId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [medicationMode, setMedicationMode] = useState<MedicationMode>('existing')
  const [selectedMedicationId, setSelectedMedicationId] = useState<number | null>(null)
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(hasRoutePatient ? routePatientId : null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [transientMedication, setTransientMedication] = useState<Medication | null>(null)

  const medicationForm = useForm<MedicationFormInput, unknown, MedicationForm>({
    resolver: zodResolver(medicationSchema),
    defaultValues: medicationDefaultValues(),
  })
  const scheduleForm = useForm<ScheduleFormInput, unknown, ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: scheduleDefaultValues(),
  })
  const doseForm = useForm<DoseFormInput, unknown, DoseForm>({
    resolver: zodResolver(doseSchema),
    defaultValues: doseDefaultValues(),
  })
  const editForm = useForm<MedicationFormInput, unknown, MedicationForm>({
    resolver: zodResolver(medicationSchema),
    defaultValues: medicationDefaultValues(),
  })

  const patientsQuery = useQuery({
    queryFn: profilesApi.listMyPatients,
    queryKey: ['my-patients'],
    retry: false,
  })

  const patients = useMemo(
    () => [...(patientsQuery.data ?? [])].sort((left, right) => left.fullName.localeCompare(right.fullName)),
    [patientsQuery.data],
  )
  const routePatient = hasRoutePatient
    ? patients.find((patient) => patient.id === routePatientId)
    : undefined
  const scopedPatients = useMemo(
    () => (isPatientRoute ? (routePatient ? [routePatient] : []) : patients),
    [isPatientRoute, patients, routePatient],
  )

  useEffect(() => {
    if (isPatientRoute) {
      setSelectedPatientId(hasRoutePatient ? routePatientId : null)
      return
    }
    if (!patients.length) {
      if (selectedPatientId) setSelectedPatientId(null)
      return
    }
    if (!selectedPatientId || !patients.some((patient) => patient.id === selectedPatientId)) {
      setSelectedPatientId(patients[0].id)
    }
  }, [hasRoutePatient, isPatientRoute, patients, routePatientId, selectedPatientId])

  const selectedPatient = scopedPatients.find((patient) => patient.id === selectedPatientId)

  useEffect(() => {
    if (selectedPatient) saveActivePatient(selectedPatient)
  }, [selectedPatient])

  useEffect(() => {
    setActiveStep('medication')
    setDeleteConfirmationOpen(false)
    setDoseActionScheduleId(null)
    setDoseError(null)
    setEditError(null)
    setEditingMedicationId(null)
    setError(null)
    setMedicationMode('existing')
    setSetupMessage(null)
    setSelectedMedicationId(null)
    setTransientMedication(null)
    medicationForm.reset(medicationDefaultValues())
    scheduleForm.reset(scheduleDefaultValues())
    doseForm.reset(doseDefaultValues())
  }, [doseForm, medicationForm, scheduleForm, selectedPatientId])

  const medicationQueries = useQueries({
    queries: scopedPatients.map((patient) => ({
      enabled: Boolean(patient.id),
      queryFn: () => medicationApi.listPatientMedications(patient.id),
      queryKey: ['medications', patient.id],
    })),
  })
  const scheduleQueries = useQueries({
    queries: scopedPatients.map((patient) => ({
      enabled: Boolean(patient.id),
      queryFn: () => medicationApi.listActiveSchedules(patient.id),
      queryKey: ['medication-schedules', patient.id],
    })),
  })
  const allMedications = useMemo<MedicationWithPatient[]>(() => {
    return scopedPatients.flatMap((patient, index) =>
      (medicationQueries[index]?.data ?? [])
        .filter((medication) => medication.active)
        .map((medication) => ({ medication, patient })),
    )
  }, [medicationQueries, scopedPatients])

  const allSchedules = useMemo<MedicationSchedule[]>(() => {
    return scheduleQueries.flatMap((query) => query.data ?? [])
  }, [scheduleQueries])

  const selectedPatientMedications = allMedications
    .filter((item) => item.patient.id === selectedPatientId)
    .map((item) => item.medication)
  const flowMedications = upsertById(
    selectedPatientMedications,
    transientMedication?.patientId === selectedPatientId ? transientMedication : null,
  )
  const selectedMedication = flowMedications.find((medication) => medication.id === selectedMedicationId)
  const selectedPatientSchedules = allSchedules.filter((schedule) => schedule.patientId === selectedPatientId)
  const scheduleCards = allSchedules
    .map<ScheduleWithContext | null>((schedule) => {
      const item = allMedications.find(({ medication }) => medication.id === schedule.medicationId)
      const patient = scopedPatients.find((value) => value.id === schedule.patientId)
      if (!item || !patient) return null
      return { medication: item.medication, patient, schedule }
    })
    .filter((value): value is ScheduleWithContext => Boolean(value))
  const doseActionTarget = scheduleCards.find((item) => item.schedule.id === doseActionScheduleId) ?? null
  const editingMedication =
    allMedications.find(({ medication }) => medication.id === editingMedicationId)?.medication ??
    (transientMedication?.id === editingMedicationId ? transientMedication : null)

  const patientOptions = (isPatientRoute ? scopedPatients : patients).map((patient) => ({
    label: patient.fullName,
    value: patient.id,
  }))
  const medicationOptions = flowMedications.map((medication) => ({
    label: medication.name,
    value: medication.id,
  }))
  const selectedMedicationIds = selectedPatientMedications.map((medication) => medication.id).join(',')
  const firstSelectedMedicationId = selectedPatientMedications[0]?.id ?? null
  const dashboardLoading = medicationQueries.some((query) => query.isLoading) || patientsQuery.isLoading
  const schedulesLoading = scheduleQueries.some((query) => query.isLoading)
  const patientsLoadError = patientsQuery.isError
    ? `No se pudo cargar tu equipo de cuidado. ${getApiErrorMessage(patientsQuery.error)}`
    : null
  const medicationLoadErrorValue = medicationQueries.find((query) => query.isError)?.error
  const medicationLoadError = medicationLoadErrorValue
    ? `No se pudieron cargar los medicamentos. ${getApiErrorMessage(medicationLoadErrorValue)}`
    : null
  const scheduleLoadErrorValue = scheduleQueries.find((query) => query.isError)?.error
  const scheduleLoadError = scheduleLoadErrorValue
    ? `No se pudieron cargar los tratamientos. ${getApiErrorMessage(scheduleLoadErrorValue)}`
    : null
  const dataLoadError = patientsLoadError ?? medicationLoadError ?? scheduleLoadError
  const canOpenTreatment = Boolean(selectedMedication)

  useEffect(() => {
    if (!selectedPatientId || transientMedication) return
    if (!selectedMedicationIds) {
      if (medicationMode === 'existing') {
        setMedicationMode('new')
        setSelectedMedicationId(null)
        scheduleForm.reset(scheduleDefaultValues())
      }
      return
    }
    if (medicationMode !== 'existing') return

    const currentMedicationStillExists = selectedMedicationIds
      .split(',')
      .some((medicationId) => Number(medicationId) === selectedMedicationId)
    if ((!selectedMedicationId || !currentMedicationStillExists) && firstSelectedMedicationId) {
      setSelectedMedicationId(firstSelectedMedicationId)
      scheduleForm.reset(scheduleDefaultValues(firstSelectedMedicationId))
    }
  }, [
    firstSelectedMedicationId,
    medicationMode,
    scheduleForm,
    selectedMedicationId,
    selectedMedicationIds,
    selectedPatientId,
    transientMedication,
  ])

  const registerMedicationMutation = useMutation({
    mutationFn: (values: MedicationForm) =>
      medicationApi.registerMedication({
        ...values,
        patientId: selectedPatientId!,
      }),
    onSuccess: (medication) => {
      setTransientMedication(medication)
      setSelectedMedicationId(medication.id)
      setMedicationMode('existing')
      setSetupMessage(null)
      medicationForm.reset(medicationDefaultValues())
      scheduleForm.reset(scheduleDefaultValues(medication.id))
      setActiveStep('treatment')
      void invalidateMedicationData(medication.patientId)
    },
  })

  const createScheduleMutation = useMutation({
    mutationFn: (values: ScheduleForm) =>
      medicationApi.createSchedule({
        administrationTime: values.administrationTime,
        endDate: values.endDate || null,
        frequencyType: values.frequencyType,
        medicationId: values.medicationId,
        patientId: selectedPatientId!,
        startDate: values.startDate,
        timesPerDay: values.timesPerDay,
      }),
    onSuccess: (schedule) => {
      const medication = flowMedications.find((item) => item.id === schedule.medicationId)
      setSetupMessage(`Tratamiento programado: ${medication?.name ?? 'medicamento'}.`)
      setActiveStep('medication')
      setDoseActionScheduleId(null)
      scheduleForm.reset(scheduleDefaultValues(schedule.medicationId))
      void queryClient.invalidateQueries({ queryKey: ['medication-schedules', schedule.patientId] })
    },
  })

  const recordDoseMutation = useMutation({
    mutationFn: (values: DoseForm) =>
      medicationApi.recordDose({
        administeredAt: ensureLocalDateTimeSeconds(nowDateTimeInput()),
        medicationId: values.medicationId,
        notes: values.notes ?? '',
        patientId: doseActionTarget?.patient.id ?? selectedPatientId!,
        scheduleId: values.scheduleId,
      }),
    onSuccess: (dose) => {
      setSetupMessage('Dosis administrada y stock actualizado.')
      setDoseError(null)
      setDoseActionScheduleId(null)
      void invalidateMedicationData(dose.patientId)
    },
  })

  const skipDoseMutation = useMutation({
    mutationFn: (values: DoseForm) =>
      medicationApi.skipDose({
        medicationId: values.medicationId,
        patientId: doseActionTarget?.patient.id ?? selectedPatientId!,
        reason: values.notes ?? '',
        scheduleId: values.scheduleId,
        skippedAt: ensureLocalDateTimeSeconds(nowDateTimeInput()),
      }),
    onSuccess: (dose) => {
      setSetupMessage('Dosis marcada como omitida.')
      setDoseError(null)
      setDoseActionScheduleId(null)
      void invalidateMedicationData(dose.patientId)
    },
  })

  const updateMedicationMutation = useMutation({
    mutationFn: (values: MedicationForm) => medicationApi.updateMedication(editingMedicationId!, values),
    onSuccess: (medication) => {
      setDeleteConfirmationOpen(false)
      setEditError(null)
      setEditingMedicationId(null)
      setTransientMedication((current) => (current?.id === medication.id ? medication : current))
      setSetupMessage('Medicamento actualizado correctamente.')
      void invalidateMedicationData(medication.patientId)
    },
  })

  const deleteMedicationMutation = useMutation({
    mutationFn: ({ medicationId }: { medicationId: number; patientId: number }) =>
      medicationApi.deleteMedication(medicationId),
    onSuccess: (_result, { medicationId, patientId }) => {
      queryClient.setQueryData<Medication[]>(['medications', patientId], (current) =>
        current?.filter((medication) => medication.id !== medicationId),
      )
      setDeleteConfirmationOpen(false)
      setEditError(null)
      setEditingMedicationId(null)
      setTransientMedication((current) => (current?.id === medicationId ? null : current))
      if (selectedMedicationId === medicationId) {
        setSelectedMedicationId(null)
        setActiveStep('medication')
        scheduleForm.reset(scheduleDefaultValues())
      }
      setSetupMessage('Medicamento retirado de los medicamentos activos. Su historial clínico se conserva.')
      void queryClient.invalidateQueries({ queryKey: ['medications', patientId] })
      void queryClient.invalidateQueries({ queryKey: ['medication-schedules', patientId] })
      void queryClient.invalidateQueries({ queryKey: ['low-stock', patientId] })
    },
  })

  function invalidateMedicationData(patientId: number) {
    void queryClient.invalidateQueries({ queryKey: ['medications', patientId] })
    void queryClient.invalidateQueries({ queryKey: ['low-stock', patientId] })
  }

  async function submitMutation<T>(
    runner: () => Promise<T>,
    requirePatient = true,
    setErrorMessage: (message: string | null) => void = setError,
  ) {
    if (requirePatient && !selectedPatientId) {
      setErrorMessage('Selecciona un paciente antes de continuar')
      return
    }
    setErrorMessage(null)
    try {
      await runner()
    } catch (submitError) {
      setErrorMessage(getApiErrorMessage(submitError))
    }
  }

  function chooseMedication(medicationId: number) {
    setSelectedMedicationId(medicationId || null)
    setTransientMedication((current) => (current?.id === medicationId ? current : null))
    scheduleForm.reset(scheduleDefaultValues(medicationId || 0))
  }

  function continueToTreatment() {
    if (!selectedMedicationId) {
      setError('Selecciona o crea un medicamento para continuar')
      return
    }
    setError(null)
    scheduleForm.reset(scheduleDefaultValues(selectedMedicationId))
    setActiveStep('treatment')
  }

  function openStep(step: SetupStep) {
    if (step === 'treatment' && !canOpenTreatment) return
    setActiveStep(step)
  }

  function openDoseAction(target: ScheduleWithContext) {
    setDeleteConfirmationOpen(false)
    setEditingMedicationId(null)
    setDoseActionScheduleId(target.schedule.id)
    setDoseError(null)
    setEditError(null)
    doseForm.reset(doseDefaultValues(target.medication.id, target.schedule.id))
  }

  function startEdit(medication: Medication) {
    setDoseActionScheduleId(null)
    setDoseError(null)
    setDeleteConfirmationOpen(false)
    setEditError(null)
    setEditingMedicationId(medication.id)
    editForm.reset({
      administrationRoute: medication.administrationRoute,
      dosageAmount: medication.dosageAmount,
      dosageUnit: medication.dosageUnit,
      expirationDate: medication.expirationDate,
      lowStockThreshold: medication.lowStockThreshold,
      name: medication.name,
      stockQuantity: medication.stockQuantity,
    })
  }

  function closeDoseModal() {
    if (recordDoseMutation.isPending || skipDoseMutation.isPending) return
    setDoseActionScheduleId(null)
    setDoseError(null)
  }

  function closeEditModal() {
    if (updateMedicationMutation.isPending || deleteMedicationMutation.isPending) return
    setDeleteConfirmationOpen(false)
    setEditError(null)
    setEditingMedicationId(null)
  }

  function startNewSetup() {
    setActiveStep('medication')
    setDeleteConfirmationOpen(false)
    setDoseActionScheduleId(null)
    setDoseError(null)
    setEditError(null)
    setEditingMedicationId(null)
    setError(null)
    setSetupMessage(null)
    medicationForm.reset(medicationDefaultValues())
    setMedicationMode('new')
    chooseMedication(0)
  }

  if (patientsQuery.isLoading) return <LoadingBlock />
  if (isPatientRoute && !hasRoutePatient) {
    return <PatientAccessState message="El código de paciente de la ruta no es válido." />
  }
  if (isPatientRoute && patientsQuery.isError) {
    return <PatientAccessState message={patientsLoadError ?? 'No se pudo verificar el acceso al paciente.'} patientId={routePatientId} />
  }
  if (isPatientRoute && patientsQuery.isSuccess && !routePatient) {
    return (
      <PatientAccessState
        message="Este paciente no pertenece a tu equipo de cuidado. Vincúlate antes de gestionar su medicación."
        patientId={routePatientId}
      />
    )
  }

  return (
    <>
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-blue-600">
            {isPatientRoute ? 'Paciente vinculado' : 'Gestión clínica'}
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">
            {isPatientRoute && selectedPatient ? `Medicación de ${selectedPatient.fullName}` : 'Centro de medicación'}
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Administra el inventario, programa tratamientos y registra cada dosis desde un solo lugar.
          </p>
        </div>
      </header>
      <FormError message={error || dataLoadError} />
      {setupMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          {setupMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(440px,520px)_1fr]">
        <div className="space-y-6">
          <Panel>
            <MedicationSectionHeader
              action={
                <Button
                  className={blueSecondaryButtonClass}
                  onClick={startNewSetup}
                  size="sm"
                  variant="secondary"
                >
                  <PackagePlus className="h-4 w-4" aria-hidden="true" />
                  Nuevo medicamento
                </Button>
              }
              eyebrow="Configuración"
              title="Preparar tratamiento"
            />
            <PanelBody className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {setupSteps.map((step) => {
                  const current = activeStep === step.id
                  const locked = step.id === 'treatment' && !canOpenTreatment
                  const done = step.id === 'medication' && Boolean(selectedMedication)
                  return (
                    <button
                      className={[
                        'flex h-16 min-w-0 items-center gap-3 rounded-lg border px-3 text-left transition',
                        current
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                          : done
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            : locked
                              ? 'border-slate-200 bg-slate-50 text-slate-400'
                              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
                      ].join(' ')}
                      disabled={locked}
                      key={step.id}
                      onClick={() => openStep(step.id)}
                      type="button"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/20 text-sm font-black">
                        {done ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : step.number}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{step.label}</span>
                        <span className="block truncate text-xs font-semibold opacity-80">
                          {current ? 'En curso' : locked ? 'Pendiente' : done ? 'Listo' : 'Disponible'}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>

              <SelectField
                disabled={isPatientRoute}
                label="Paciente"
                onChange={(event) => setSelectedPatientId(Number(event.target.value) || null)}
                options={[{ label: 'Seleccione', value: 0 }, ...patientOptions]}
                value={selectedPatientId ?? 0}
              />

              {activeStep === 'medication' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className={[
                        'h-10 rounded-lg border px-3 text-sm font-bold transition',
                        medicationMode === 'existing'
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                      ].join(' ')}
                      disabled={!flowMedications.length}
                      onClick={() => {
                        setMedicationMode('existing')
                        if (!selectedMedicationId && flowMedications[0]) chooseMedication(flowMedications[0].id)
                      }}
                      type="button"
                    >
                      Usar existente
                    </button>
                    <button
                      className={[
                        'h-10 rounded-lg border px-3 text-sm font-bold transition',
                        medicationMode === 'new'
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                      ].join(' ')}
                      onClick={() => {
                        setMedicationMode('new')
                        setSelectedMedicationId(null)
                        setTransientMedication(null)
                        scheduleForm.reset(scheduleDefaultValues())
                      }}
                      type="button"
                    >
                      Crear nuevo
                    </button>
                  </div>

                  {medicationMode === 'existing' ? (
                    <div className="space-y-4">
                      {flowMedications.length ? (
                        <>
                          <SelectField
                            label="Medicamento guardado"
                            onChange={(event) => chooseMedication(Number(event.target.value))}
                            options={[{ label: 'Seleccione', value: 0 }, ...medicationOptions]}
                            value={selectedMedicationId ?? 0}
                          />
                          {selectedMedication ? (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-slate-950">
                                    {selectedMedication.name}
                                  </p>
                                  <p className="mt-1 text-xs font-semibold text-slate-500">
                                    {selectedMedication.dosageAmount} {selectedMedication.dosageUnit} -{' '}
                                    {enumLabel(selectedMedication.administrationRoute)}
                                  </p>
                                </div>
                              <StatusBadge tone="emerald">Activo</StatusBadge>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Stock</p>
                                  <p className="font-bold text-slate-800">
                                    {selectedMedication.stockQuantity}/{selectedMedication.lowStockThreshold}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                    Vencimiento
                                  </p>
                                  <p className="font-bold text-slate-800">
                                    {formatDate(selectedMedication.expirationDate)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : null}
                          <Button className={`w-full ${blueButtonClass}`} onClick={continueToTreatment}>
                            <CalendarClock className="h-4 w-4" aria-hidden="true" />
                            Programar tratamiento
                          </Button>
                        </>
                      ) : (
                        <EmptyState title="Sin medicamentos guardados" />
                      )}
                    </div>
                  ) : (
                    <form
                      className="space-y-4"
                      onSubmit={medicationForm.handleSubmit((values) =>
                        submitMutation(() => registerMedicationMutation.mutateAsync(values)),
                      )}
                    >
                      <TextField
                        error={medicationForm.formState.errors.name?.message}
                        label="Nombre del medicamento (genérico o comercial)"
                        placeholder="Ej. Paracetamol o Panadol"
                        {...medicationForm.register('name')}
                      />
                      <p className="-mt-2 text-xs font-medium leading-relaxed text-slate-500">
                        Este nombre identifica qué medicamento corresponde al tratamiento, las dosis y las alertas de stock.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <TextField
                          error={medicationForm.formState.errors.dosageAmount?.message}
                          label="Dosis base"
                          step="0.01"
                          type="number"
                          {...medicationForm.register('dosageAmount')}
                        />
                        <SelectField
                          error={medicationForm.formState.errors.dosageUnit?.message}
                          label="Unidad"
                          options={dosageUnitOptions}
                          {...medicationForm.register('dosageUnit')}
                        />
                      </div>
                      <SelectField
                        error={medicationForm.formState.errors.administrationRoute?.message}
                        label="Vía"
                        options={routeOptions}
                        {...medicationForm.register('administrationRoute')}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <TextField
                          error={medicationForm.formState.errors.stockQuantity?.message}
                          label="Stock disponible"
                          type="number"
                          {...medicationForm.register('stockQuantity')}
                        />
                        <TextField
                          error={medicationForm.formState.errors.lowStockThreshold?.message}
                          label="Alerta de stock"
                          type="number"
                          {...medicationForm.register('lowStockThreshold')}
                        />
                      </div>
                      <TextField
                        error={medicationForm.formState.errors.expirationDate?.message}
                        label="Vencimiento del stock"
                        type="date"
                        {...medicationForm.register('expirationDate')}
                      />
                      <Button
                        className={`w-full ${blueButtonClass}`}
                        isLoading={registerMedicationMutation.isPending}
                        type="submit"
                      >
                        <Pill className="h-4 w-4" aria-hidden="true" />
                        Guardar medicamento
                      </Button>
                    </form>
                  )}
                </div>
              ) : null}

              {activeStep === 'treatment' ? (
                <form
                  className="space-y-4"
                  onSubmit={scheduleForm.handleSubmit((values) =>
                    submitMutation(() => createScheduleMutation.mutateAsync(values)),
                  )}
                >
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Medicamento</p>
                        <p className="mt-1 truncate text-sm font-black text-slate-950">
                          {selectedMedication?.name ?? 'Seleccione medicamento'}
                        </p>
                      </div>
                      <Button
                        className={blueSecondaryButtonClass}
                        onClick={() => setActiveStep('medication')}
                        size="sm"
                        variant="secondary"
                      >
                        Cambiar
                      </Button>
                    </div>
                  </div>
                  <input type="hidden" {...scheduleForm.register('medicationId')} />
                  <SelectField
                    error={scheduleForm.formState.errors.frequencyType?.message}
                    label="Frecuencia"
                    options={frequencyOptions}
                    {...scheduleForm.register('frequencyType')}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      error={scheduleForm.formState.errors.timesPerDay?.message}
                      label="Veces por día"
                      type="number"
                      {...scheduleForm.register('timesPerDay')}
                    />
                    <TextField
                      error={scheduleForm.formState.errors.administrationTime?.message}
                      label="Hora"
                      type="time"
                      {...scheduleForm.register('administrationTime')}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      error={scheduleForm.formState.errors.startDate?.message}
                      label="Inicio del tratamiento"
                      type="date"
                      {...scheduleForm.register('startDate')}
                    />
                    <TextField
                      error={scheduleForm.formState.errors.endDate?.message}
                      label="Fin del tratamiento"
                      type="date"
                      {...scheduleForm.register('endDate')}
                    />
                  </div>
                  <Button
                    className={`w-full ${blueButtonClass}`}
                    isLoading={createScheduleMutation.isPending}
                    type="submit"
                  >
                    <ClipboardList className="h-4 w-4" aria-hidden="true" />
                    Crear tratamiento
                  </Button>
                </form>
              ) : null}
            </PanelBody>
          </Panel>

        </div>

        <div className="space-y-6">
          <Panel>
            <MedicationSectionHeader eyebrow="Dashboard" title="Tratamientos activos" />
            <PanelBody className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tratamientos</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{scheduleCards.length}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Medicamentos</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{allMedications.length}</p>
                </div>
              </div>

              {scheduleLoadError && !scheduleCards.length ? (
                <FormError message={scheduleLoadError} />
              ) : schedulesLoading ? (
                <LoadingBlock />
              ) : scheduleCards.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {scheduleCards.map((item) => (
                    <article
                      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                      key={item.schedule.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950">{item.medication.name}</p>
                          <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                            {item.patient.fullName}
                          </p>
                        </div>
                        <StatusBadge tone="blue">{enumLabel(item.schedule.frequencyType)}</StatusBadge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Hora</p>
                          <p className="font-bold text-slate-800">
                            {formatTreatmentTime(item.schedule.administrationTime)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Veces/día</p>
                          <p className="font-bold text-slate-800">{item.schedule.timesPerDay}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Inicio</p>
                          <p className="font-bold text-slate-800">{formatDate(item.schedule.startDate)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Fin</p>
                          <p className="font-bold text-slate-800">{formatDate(item.schedule.endDate)}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Button className={blueButtonClass} onClick={() => openDoseAction(item)} size="sm">
                          <Syringe className="h-4 w-4" aria-hidden="true" />
                          Dosis
                        </Button>
                        <Button onClick={() => startEdit(item.medication)} size="sm" variant="secondary">
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          Editar
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="Sin tratamientos activos" />
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <MedicationSectionHeader eyebrow="Inventario" title="Medicamentos activos" />
            <PanelBody>
              {medicationLoadError && !allMedications.length ? (
                <FormError message={medicationLoadError} />
              ) : dashboardLoading ? (
                <LoadingBlock />
              ) : allMedications.length ? (
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                  {allMedications.map(({ medication, patient }) => (
                    <div
                      className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(180px,1.4fr)_minmax(160px,1fr)_90px_120px_auto] md:items-center"
                      key={medication.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-950">{medication.name}</p>
                        <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{patient.fullName}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Dosis</p>
                        <p className="font-bold text-slate-800">
                          {medication.dosageAmount} {medication.dosageUnit} · {enumLabel(medication.administrationRoute)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Stock</p>
                        <p className="font-bold text-slate-800">
                          {medication.stockQuantity}/{medication.lowStockThreshold}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Vence</p>
                        <p className="font-bold text-slate-800">{formatDate(medication.expirationDate)}</p>
                      </div>
                      <Button
                        className="md:justify-self-end"
                        onClick={() => startEdit(medication)}
                        size="sm"
                        variant="secondary"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Editar
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Sin medicamentos activos" />
              )}
            </PanelBody>
          </Panel>

          {!isPatientRoute ? (
            <Panel>
              <MedicationSectionHeader eyebrow="Paciente seleccionado" title="Tratamientos" />
              <PanelBody>
                {scheduleLoadError && !selectedPatientSchedules.length ? (
                  <FormError message={scheduleLoadError} />
                ) : selectedPatientSchedules.length ? (
                  <div className="space-y-2">
                    {selectedPatientSchedules.map((schedule) => {
                      const medication = flowMedications.find((item) => item.id === schedule.medicationId)
                      return (
                        <div
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
                          key={schedule.id}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-950">
                              {medication?.name ?? 'Medicamento'}
                            </p>
                            <p className="text-xs font-semibold text-slate-500">
                              {enumLabel(schedule.frequencyType)} - {formatTreatmentTime(schedule.administrationTime)}
                            </p>
                          </div>
                          <StatusBadge tone="blue">{formatDate(schedule.startDate)}</StatusBadge>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <EmptyState title="Sin tratamientos activos" />
                )}
              </PanelBody>
            </Panel>
          ) : null}
        </div>
      </div>

      <Modal
        closeDisabled={recordDoseMutation.isPending || skipDoseMutation.isPending}
        description={
          doseActionTarget
            ? `${doseActionTarget.patient.fullName} · ${enumLabel(doseActionTarget.schedule.frequencyType)} · ${formatTreatmentTime(doseActionTarget.schedule.administrationTime)}`
            : undefined
        }
        eyebrow="Dosis"
        isOpen={Boolean(doseActionTarget)}
        onClose={closeDoseModal}
        size="sm"
        title={doseActionTarget ? `Registrar administración: ${doseActionTarget.medication.name}` : 'Registrar administración'}
      >
        {doseActionTarget ? (
          <form
            className="space-y-5"
            onSubmit={doseForm.handleSubmit((values) =>
              submitMutation(() => recordDoseMutation.mutateAsync(values), false, setDoseError),
            )}
          >
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-black text-slate-950">{doseActionTarget.medication.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">
                {doseActionTarget.medication.dosageAmount} {doseActionTarget.medication.dosageUnit} ·{' '}
                {enumLabel(doseActionTarget.medication.administrationRoute)}
              </p>
            </div>

            {doseError ? (
              <div role="alert">
                <FormError message={doseError} />
              </div>
            ) : null}

            <input type="hidden" {...doseForm.register('medicationId')} />
            <input type="hidden" {...doseForm.register('scheduleId')} />
            <input type="hidden" {...doseForm.register('occurredAt')} />
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
              Se registrará automáticamente con la hora actual de Perú al confirmar.
            </div>
            <TextareaField
              error={doseForm.formState.errors.notes?.message}
              label="Notas (opcional)"
              placeholder="Añade una observación si es necesario"
              {...doseForm.register('notes')}
            />

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                className={blueButtonClass}
                disabled={skipDoseMutation.isPending}
                isLoading={recordDoseMutation.isPending}
                type="submit"
              >
                <Syringe className="h-4 w-4" aria-hidden="true" />
                Registrar administrada
              </Button>
              <Button
                disabled={recordDoseMutation.isPending}
                isLoading={skipDoseMutation.isPending}
                onClick={doseForm.handleSubmit((values) =>
                  submitMutation(() => skipDoseMutation.mutateAsync(values), false, setDoseError),
                )}
                type="button"
                variant="secondary"
              >
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Registrar omitida
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        closeDisabled={updateMedicationMutation.isPending || deleteMedicationMutation.isPending}
        description="Actualiza sus datos o retíralo de la lista de medicamentos activos."
        eyebrow="Inventario"
        isOpen={Boolean(editingMedication)}
        onClose={closeEditModal}
        size="md"
        title="Editar medicamento"
      >
        {editingMedication ? (
          <div className="space-y-6">
            {editError ? (
              <div role="alert">
                <FormError message={editError} />
              </div>
            ) : null}

            <form
              className="space-y-4"
              onSubmit={editForm.handleSubmit((values) =>
                submitMutation(() => updateMedicationMutation.mutateAsync(values), false, setEditError),
              )}
            >
              <div>
                <TextField
                  error={editForm.formState.errors.name?.message}
                  label="Nombre del medicamento (genérico o comercial)"
                  placeholder="Ej. Paracetamol o Panadol"
                  {...editForm.register('name')}
                />
                <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
                  Permite identificar el medicamento correcto en tratamientos, dosis, reportes y alertas de stock.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  error={editForm.formState.errors.dosageAmount?.message}
                  label="Dosis base"
                  step="0.01"
                  type="number"
                  {...editForm.register('dosageAmount')}
                />
                <SelectField
                  error={editForm.formState.errors.dosageUnit?.message}
                  label="Unidad"
                  options={dosageUnitOptions}
                  {...editForm.register('dosageUnit')}
                />
              </div>
              <SelectField
                error={editForm.formState.errors.administrationRoute?.message}
                label="Vía de administración"
                options={routeOptions}
                {...editForm.register('administrationRoute')}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  error={editForm.formState.errors.stockQuantity?.message}
                  label="Stock disponible"
                  type="number"
                  {...editForm.register('stockQuantity')}
                />
                <TextField
                  error={editForm.formState.errors.lowStockThreshold?.message}
                  label="Alerta de stock"
                  type="number"
                  {...editForm.register('lowStockThreshold')}
                />
              </div>
              <TextField
                error={editForm.formState.errors.expirationDate?.message}
                label="Vencimiento del stock"
                type="date"
                {...editForm.register('expirationDate')}
              />

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <Button
                  disabled={updateMedicationMutation.isPending || deleteMedicationMutation.isPending}
                  onClick={closeEditModal}
                  type="button"
                  variant="secondary"
                >
                  Cancelar
                </Button>
                <Button
                  className={blueButtonClass}
                  disabled={deleteMedicationMutation.isPending}
                  isLoading={updateMedicationMutation.isPending}
                  type="submit"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Guardar cambios
                </Button>
              </div>
            </form>

            <section className="border-t border-slate-200 pt-5" aria-labelledby="retire-medication-title">
              {deleteConfirmationOpen ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <h3 className="text-sm font-black text-rose-950" id="retire-medication-title">
                    ¿Retirar {editingMedication.name}?
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-rose-900">
                    Dejará de aparecer entre los medicamentos activos y no podrá usarse en nuevos tratamientos. Las
                    dosis y registros existentes se conservarán en el historial clínico.
                  </p>
                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      disabled={deleteMedicationMutation.isPending}
                      onClick={() => setDeleteConfirmationOpen(false)}
                      type="button"
                      variant="secondary"
                    >
                      Volver
                    </Button>
                    <Button
                      isLoading={deleteMedicationMutation.isPending}
                      onClick={() =>
                        void submitMutation(
                          () =>
                            deleteMedicationMutation.mutateAsync({
                              medicationId: editingMedication.id,
                              patientId: editingMedication.patientId,
                            }),
                          false,
                          setEditError,
                        )
                      }
                      type="button"
                      variant="danger"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Confirmar retiro
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-950" id="retire-medication-title">
                      Retirar medicamento
                    </h3>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      Lo quita de la lista activa, pero conserva su historial clínico.
                    </p>
                  </div>
                  <Button
                    disabled={updateMedicationMutation.isPending}
                    onClick={() => {
                      setEditError(null)
                      setDeleteConfirmationOpen(true)
                    }}
                    type="button"
                    variant="danger"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Retirar medicamento
                  </Button>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </Modal>
    </>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  PackagePlus,
  Pencil,
  Pill,
  Save,
  Syringe,
  X,
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
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { StatusBadge } from '@/shared/components/StatusBadge'
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

export function MedicationPage() {
  const params = useParams()
  const routePatientId = Number(params.patientId)
  const hasRoutePatient = Number.isFinite(routePatientId) && routePatientId > 0
  const queryClient = useQueryClient()
  const [activeStep, setActiveStep] = useState<SetupStep>('medication')
  const [doseActionScheduleId, setDoseActionScheduleId] = useState<number | null>(null)
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
  const routePatientQuery = useQuery({
    enabled: hasRoutePatient,
    queryFn: () => profilesApi.getPatient(routePatientId),
    queryKey: ['patient', routePatientId],
    retry: false,
  })

  const patients = useMemo(() => {
    const map = new Map<number, PatientProfile>()
    patientsQuery.data?.forEach((patient) => map.set(patient.id, patient))
    if (routePatientQuery.data) map.set(routePatientQuery.data.id, routePatientQuery.data)
    return [...map.values()].sort((left, right) => left.fullName.localeCompare(right.fullName))
  }, [patientsQuery.data, routePatientQuery.data])

  useEffect(() => {
    if (hasRoutePatient) {
      setSelectedPatientId(routePatientId)
      return
    }
    if (!selectedPatientId && patients.length) {
      setSelectedPatientId(patients[0].id)
    }
  }, [hasRoutePatient, patients, routePatientId, selectedPatientId])

  useEffect(() => {
    const selectedPatient = patients.find((patient) => patient.id === selectedPatientId)
    if (selectedPatient) saveActivePatient(selectedPatient)
  }, [patients, selectedPatientId])

  useEffect(() => {
    setActiveStep('medication')
    setDoseActionScheduleId(null)
    setEditingMedicationId(null)
    setError(null)
    setSetupMessage(null)
    setSelectedMedicationId(null)
    setTransientMedication(null)
    medicationForm.reset(medicationDefaultValues())
    scheduleForm.reset(scheduleDefaultValues())
    doseForm.reset(doseDefaultValues())
  }, [doseForm, medicationForm, scheduleForm, selectedPatientId])

  const medicationQueries = useQueries({
    queries: patients.map((patient) => ({
      enabled: Boolean(patient.id),
      queryFn: () => medicationApi.listPatientMedications(patient.id),
      queryKey: ['medications', patient.id],
    })),
  })
  const scheduleQueries = useQueries({
    queries: patients.map((patient) => ({
      enabled: Boolean(patient.id),
      queryFn: () => medicationApi.listActiveSchedules(patient.id),
      queryKey: ['medication-schedules', patient.id],
    })),
  })
  const lowStockQuery = useQuery({
    enabled: Boolean(selectedPatientId),
    queryFn: () => medicationApi.listLowStock(selectedPatientId!),
    queryKey: ['low-stock', selectedPatientId],
  })

  const allMedications = useMemo<MedicationWithPatient[]>(() => {
    return patients.flatMap((patient, index) =>
      (medicationQueries[index]?.data ?? [])
        .filter((medication) => medication.active)
        .map((medication) => ({ medication, patient })),
    )
  }, [medicationQueries, patients])

  const allSchedules = useMemo<MedicationSchedule[]>(() => {
    return scheduleQueries.flatMap((query) => query.data ?? [])
  }, [scheduleQueries])

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId)
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
      const patient = patients.find((value) => value.id === schedule.patientId)
      if (!item || !patient) return null
      return { medication: item.medication, patient, schedule }
    })
    .filter((value): value is ScheduleWithContext => Boolean(value))
  const doseActionTarget = scheduleCards.find((item) => item.schedule.id === doseActionScheduleId) ?? null

  const patientOptions = patients.map((patient) => ({
    label: patient.fullName,
    value: patient.id,
  }))
  const medicationOptions = flowMedications.map((medication) => ({
    label: medication.name,
    value: medication.id,
  }))
  const selectedMedicationIds = selectedPatientMedications.map((medication) => medication.id).join(',')
  const dashboardLoading = medicationQueries.some((query) => query.isLoading) || patientsQuery.isLoading
  const schedulesLoading = scheduleQueries.some((query) => query.isLoading)
  const lowStockCount = allMedications.filter(
    ({ medication }) => medication.stockQuantity <= medication.lowStockThreshold,
  ).length
  const canOpenTreatment = Boolean(selectedMedication)

  useEffect(() => {
    if (!selectedPatientId || transientMedication) return
    const currentMedicationStillExists = selectedPatientMedications.some(
      (medication) => medication.id === selectedMedicationId,
    )
    if (selectedPatientMedications.length && (!selectedMedicationId || !currentMedicationStillExists)) {
      const firstMedication = selectedPatientMedications[0]
      setMedicationMode('existing')
      setSelectedMedicationId(firstMedication.id)
      scheduleForm.reset(scheduleDefaultValues(firstMedication.id))
      return
    }
    if (!selectedPatientMedications.length && medicationMode === 'existing') {
      setMedicationMode('new')
      setSelectedMedicationId(null)
      scheduleForm.reset(scheduleDefaultValues())
    }
  }, [
    medicationMode,
    scheduleForm,
    selectedMedicationId,
    selectedMedicationIds,
    selectedPatientId,
    selectedPatientMedications,
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
        administeredAt: ensureLocalDateTimeSeconds(values.occurredAt),
        medicationId: values.medicationId,
        notes: values.notes ?? '',
        patientId: doseActionTarget?.patient.id ?? selectedPatientId!,
        scheduleId: values.scheduleId,
      }),
    onSuccess: (dose) => {
      setSetupMessage('Dosis administrada y stock actualizado.')
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
        skippedAt: ensureLocalDateTimeSeconds(values.occurredAt),
      }),
    onSuccess: (dose) => {
      setSetupMessage('Dosis marcada como omitida.')
      setDoseActionScheduleId(null)
      void invalidateMedicationData(dose.patientId)
    },
  })

  const updateMedicationMutation = useMutation({
    mutationFn: (values: MedicationForm) => medicationApi.updateMedication(editingMedicationId!, values),
    onSuccess: (medication) => {
      setEditingMedicationId(null)
      setTransientMedication((current) => (current?.id === medication.id ? medication : current))
      void invalidateMedicationData(medication.patientId)
    },
  })

  function invalidateMedicationData(patientId: number) {
    void queryClient.invalidateQueries({ queryKey: ['medications', patientId] })
    void queryClient.invalidateQueries({ queryKey: ['low-stock', patientId] })
  }

  async function submitMutation<T>(runner: () => Promise<T>, requirePatient = true) {
    if (requirePatient && !selectedPatientId) {
      setError('Selecciona un paciente antes de continuar')
      return
    }
    setError(null)
    try {
      await runner()
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
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
    setDoseActionScheduleId(target.schedule.id)
    setError(null)
    doseForm.reset(doseDefaultValues(target.medication.id, target.schedule.id))
  }

  function startEdit(medication: Medication) {
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

  function startNewSetup() {
    setActiveStep('medication')
    setDoseActionScheduleId(null)
    setError(null)
    setSetupMessage(null)
    medicationForm.reset(medicationDefaultValues())
    if (flowMedications.length) {
      setMedicationMode('existing')
      chooseMedication(flowMedications[0].id)
      return
    }
    setMedicationMode('new')
    chooseMedication(0)
  }

  return (
    <>
      <PageHeader
        eyebrow={selectedPatient ? 'Paciente activo' : 'Medicacion'}
        title={selectedPatient ? `Medicacion - ${selectedPatient.fullName}` : 'Medicacion'}
      />
      <FormError message={error} />
      {setupMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          {setupMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-[minmax(440px,520px)_1fr] gap-6">
        <div className="space-y-6">
          <Panel>
            <PanelHeader
              action={
                <Button onClick={startNewSetup} size="sm" variant="secondary">
                  <PackagePlus className="h-4 w-4" aria-hidden="true" />
                  Nuevo
                </Button>
              }
              eyebrow="Configuracion"
              title="Nuevo tratamiento"
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
                          ? 'border-teal-700 bg-teal-700 text-white'
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
                disabled={hasRoutePatient}
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
                          ? 'border-teal-700 bg-teal-700 text-white'
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
                          ? 'border-teal-700 bg-teal-700 text-white'
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
                                <StatusBadge
                                  tone={
                                    selectedMedication.stockQuantity <= selectedMedication.lowStockThreshold
                                      ? 'amber'
                                      : 'emerald'
                                  }
                                >
                                  {selectedMedication.stockQuantity <= selectedMedication.lowStockThreshold
                                    ? 'Stock bajo'
                                    : 'Activo'}
                                </StatusBadge>
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
                          <Button className="w-full" onClick={continueToTreatment}>
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
                        label="Nombre del medicamento"
                        {...medicationForm.register('name')}
                      />
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
                        label="Via"
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
                      <Button className="w-full" isLoading={registerMedicationMutation.isPending} type="submit">
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
                      <Button onClick={() => setActiveStep('medication')} size="sm" variant="secondary">
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
                      label="Veces por dia"
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
                  <Button className="w-full" isLoading={createScheduleMutation.isPending} type="submit">
                    <ClipboardList className="h-4 w-4" aria-hidden="true" />
                    Crear tratamiento
                  </Button>
                </form>
              ) : null}
            </PanelBody>
          </Panel>

          {doseActionTarget ? (
            <Panel>
              <PanelHeader
                action={
                  <Button onClick={() => setDoseActionScheduleId(null)} size="sm" variant="ghost">
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                }
                eyebrow="Dosis"
                title="Registrar evento"
              />
              <PanelBody>
                <form className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-black text-slate-950">{doseActionTarget.medication.name}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {doseActionTarget.patient.fullName} - {enumLabel(doseActionTarget.schedule.frequencyType)} -{' '}
                      {doseActionTarget.schedule.administrationTime}
                    </p>
                  </div>
                  <input type="hidden" {...doseForm.register('medicationId')} />
                  <input type="hidden" {...doseForm.register('scheduleId')} />
                  <TextField
                    error={doseForm.formState.errors.occurredAt?.message}
                    label="Fecha y hora"
                    type="datetime-local"
                    {...doseForm.register('occurredAt')}
                  />
                  <TextareaField error={doseForm.formState.errors.notes?.message} label="Notas" {...doseForm.register('notes')} />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      isLoading={recordDoseMutation.isPending}
                      onClick={doseForm.handleSubmit((values) =>
                        submitMutation(() => recordDoseMutation.mutateAsync(values), false),
                      )}
                      type="button"
                    >
                      <Syringe className="h-4 w-4" aria-hidden="true" />
                      Administrar
                    </Button>
                    <Button
                      isLoading={skipDoseMutation.isPending}
                      onClick={doseForm.handleSubmit((values) =>
                        submitMutation(() => skipDoseMutation.mutateAsync(values), false),
                      )}
                      type="button"
                      variant="secondary"
                    >
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      Omitir
                    </Button>
                  </div>
                </form>
              </PanelBody>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader eyebrow="Dashboard" title="Tratamientos activos" />
            <PanelBody className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tratamientos</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{scheduleCards.length}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Medicamentos</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{allMedications.length}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Stock bajo</p>
                  <p className="mt-1 text-2xl font-black text-amber-900">{lowStockCount}</p>
                </div>
              </div>

              {schedulesLoading ? (
                <LoadingBlock />
              ) : scheduleCards.length ? (
                <div className="grid grid-cols-2 gap-3">
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
                        <StatusBadge tone="teal">{enumLabel(item.schedule.frequencyType)}</StatusBadge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Hora</p>
                          <p className="font-bold text-slate-800">{item.schedule.administrationTime}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Veces/dia</p>
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
                        <Button onClick={() => openDoseAction(item)} size="sm">
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
            <PanelHeader eyebrow="Inventario" title="Medicamentos activos" />
            <PanelBody>
              {dashboardLoading ? (
                <LoadingBlock />
              ) : allMedications.length ? (
                <div className="grid grid-cols-3 gap-3">
                  {allMedications.map(({ medication, patient }) => (
                    <article
                      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                      key={medication.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950">{medication.name}</p>
                          <p className="mt-1 truncate text-xs font-semibold text-slate-500">{patient.fullName}</p>
                        </div>
                        <StatusBadge tone={medication.stockQuantity <= medication.lowStockThreshold ? 'amber' : 'emerald'}>
                          {medication.stockQuantity <= medication.lowStockThreshold ? 'Stock bajo' : 'Activo'}
                        </StatusBadge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Dosis</p>
                          <p className="font-bold text-slate-800">
                            {medication.dosageAmount} {medication.dosageUnit}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Via</p>
                          <p className="font-bold text-slate-800">{enumLabel(medication.administrationRoute)}</p>
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
                      </div>
                      <Button
                        className="mt-4 w-full"
                        onClick={() => startEdit(medication)}
                        size="sm"
                        variant="secondary"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Editar
                      </Button>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="Sin medicamentos activos" />
              )}
            </PanelBody>
          </Panel>

          {editingMedicationId ? (
            <Panel>
              <PanelHeader eyebrow="Edicion" title="Editar medicamento" />
              <PanelBody>
                <form
                  className="grid grid-cols-4 gap-3"
                  onSubmit={editForm.handleSubmit((values) =>
                    submitMutation(() => updateMedicationMutation.mutateAsync(values), false),
                  )}
                >
                  <TextField error={editForm.formState.errors.name?.message} label="Nombre" {...editForm.register('name')} />
                  <TextField
                    error={editForm.formState.errors.dosageAmount?.message}
                    label="Dosis"
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
                  <SelectField
                    error={editForm.formState.errors.administrationRoute?.message}
                    label="Via"
                    options={routeOptions}
                    {...editForm.register('administrationRoute')}
                  />
                  <TextField
                    error={editForm.formState.errors.stockQuantity?.message}
                    label="Stock"
                    type="number"
                    {...editForm.register('stockQuantity')}
                  />
                  <TextField
                    error={editForm.formState.errors.lowStockThreshold?.message}
                    label="Alerta"
                    type="number"
                    {...editForm.register('lowStockThreshold')}
                  />
                  <TextField
                    error={editForm.formState.errors.expirationDate?.message}
                    label="Vencimiento"
                    type="date"
                    {...editForm.register('expirationDate')}
                  />
                  <div className="flex items-end gap-2">
                    <Button isLoading={updateMedicationMutation.isPending} type="submit">
                      <Save className="h-4 w-4" aria-hidden="true" />
                      Guardar
                    </Button>
                    <Button onClick={() => setEditingMedicationId(null)} type="button" variant="secondary">
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </form>
              </PanelBody>
            </Panel>
          ) : null}

          <div className="grid grid-cols-2 gap-6">
            <Panel>
              <PanelHeader eyebrow="Paciente seleccionado" title="Tratamientos" />
              <PanelBody>
                {selectedPatientSchedules.length ? (
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
                              {enumLabel(schedule.frequencyType)} - {schedule.administrationTime}
                            </p>
                          </div>
                          <StatusBadge tone="teal">{formatDate(schedule.startDate)}</StatusBadge>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <EmptyState title="Sin tratamientos activos" />
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Alertas" title="Stock bajo" />
              <PanelBody>
                {lowStockQuery.data?.length ? (
                  <div className="space-y-2">
                    {lowStockQuery.data.map((alert) => (
                      <div
                        className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900"
                        key={alert.medicationId}
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>
                          {alert.medicationName}: {alert.currentStock}/{alert.threshold}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Sin alertas de stock" />
                )}
              </PanelBody>
            </Panel>
          </div>
        </div>
      </div>
    </>
  )
}

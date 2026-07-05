import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import { CalendarClock, Pencil, Pill, Save, Syringe, X } from 'lucide-react'
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
type FlowStep = 'medication' | 'schedule' | 'dose'

type MedicationWithPatient = {
  medication: Medication
  patient: PatientProfile
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

export function MedicationPage() {
  const params = useParams()
  const routePatientId = Number(params.patientId)
  const hasRoutePatient = Number.isFinite(routePatientId) && routePatientId > 0
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState<FlowStep>('medication')
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(hasRoutePatient ? routePatientId : null)
  const [editingMedicationId, setEditingMedicationId] = useState<number | null>(null)

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
  const selectedPatientSchedules = allSchedules.filter((schedule) => schedule.patientId === selectedPatientId)

  const selectedDoseMedicationId = Number(doseForm.watch('medicationId'))
  const doseScheduleOptions = selectedPatientSchedules
    .filter((schedule) => !selectedDoseMedicationId || schedule.medicationId === selectedDoseMedicationId)
    .map((schedule) => {
      const medication = selectedPatientMedications.find((item) => item.id === schedule.medicationId)
      return {
        label: `${medication?.name ?? 'Medicamento'} - ${enumLabel(schedule.frequencyType)} ${schedule.administrationTime}`,
        value: schedule.id,
      }
    })

  const patientOptions = patients.map((patient) => ({
    label: patient.fullName,
    value: patient.id,
  }))
  const medicationOptions = selectedPatientMedications.map((medication) => ({
    label: medication.name,
    value: medication.id,
  }))
  const dashboardLoading = medicationQueries.some((query) => query.isLoading) || patientsQuery.isLoading

  const registerMedicationMutation = useMutation({
    mutationFn: (values: MedicationForm) =>
      medicationApi.registerMedication({
        ...values,
        patientId: selectedPatientId!,
      }),
    onSuccess: (medication) => {
      medicationForm.reset(medicationDefaultValues())
      scheduleForm.reset(scheduleDefaultValues(medication.id))
      doseForm.reset(doseDefaultValues(medication.id, 0))
      setActiveStep('schedule')
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
      scheduleForm.reset(scheduleDefaultValues(schedule.medicationId))
      doseForm.reset(doseDefaultValues(schedule.medicationId, schedule.id))
      setActiveStep('dose')
      void queryClient.invalidateQueries({ queryKey: ['medication-schedules', schedule.patientId] })
    },
  })

  const recordDoseMutation = useMutation({
    mutationFn: (values: DoseForm) =>
      medicationApi.recordDose({
        administeredAt: ensureLocalDateTimeSeconds(values.occurredAt),
        medicationId: values.medicationId,
        notes: values.notes ?? '',
        patientId: selectedPatientId!,
        scheduleId: values.scheduleId,
      }),
    onSuccess: (dose) => {
      doseForm.reset(doseDefaultValues(dose.medicationId, dose.scheduleId))
      void invalidateMedicationData(dose.patientId)
    },
  })

  const skipDoseMutation = useMutation({
    mutationFn: (values: DoseForm) =>
      medicationApi.skipDose({
        medicationId: values.medicationId,
        patientId: selectedPatientId!,
        reason: values.notes ?? '',
        scheduleId: values.scheduleId,
        skippedAt: ensureLocalDateTimeSeconds(values.occurredAt),
      }),
    onSuccess: (dose) => {
      doseForm.reset(doseDefaultValues(dose.medicationId, dose.scheduleId))
      void invalidateMedicationData(dose.patientId)
    },
  })

  const updateMedicationMutation = useMutation({
    mutationFn: (values: MedicationForm) => medicationApi.updateMedication(editingMedicationId!, values),
    onSuccess: (medication) => {
      setEditingMedicationId(null)
      void invalidateMedicationData(medication.patientId)
    },
  })

  function invalidateMedicationData(patientId: number) {
    void queryClient.invalidateQueries({ queryKey: ['medications', patientId] })
    void queryClient.invalidateQueries({ queryKey: ['low-stock', patientId] })
  }

  async function submitMutation<T>(runner: () => Promise<T>) {
    if (!selectedPatientId) {
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

  return (
    <>
      <PageHeader
        eyebrow={selectedPatient ? 'Paciente activo' : 'Medicacion'}
        title={selectedPatient ? `Medicacion - ${selectedPatient.fullName}` : 'Medicacion'}
      />
      <FormError message={error} />

      <div className="grid grid-cols-[minmax(380px,460px)_1fr] gap-6">
        <div className="space-y-6">
          <Panel>
            <PanelHeader eyebrow="Flujo" title="Nueva medicacion" />
            <PanelBody className="space-y-5">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['medication', '1. Medicamento'],
                  ['schedule', '2. Horario'],
                  ['dose', '3. Dosis'],
                ].map(([step, label]) => (
                  <button
                    className={[
                      'h-10 rounded-lg border text-xs font-bold transition',
                      activeStep === step
                        ? 'border-teal-700 bg-teal-700 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                    key={step}
                    onClick={() => setActiveStep(step as FlowStep)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <SelectField
                disabled={hasRoutePatient}
                label="Paciente"
                onChange={(event) => setSelectedPatientId(Number(event.target.value))}
                options={[{ label: 'Seleccione', value: 0 }, ...patientOptions]}
                value={selectedPatientId ?? 0}
              />

              {activeStep === 'medication' ? (
                <form
                  className="space-y-4"
                  onSubmit={medicationForm.handleSubmit((values) =>
                    submitMutation(() => registerMedicationMutation.mutateAsync(values)),
                  )}
                >
                  <TextField error={medicationForm.formState.errors.name?.message} label="Nombre" {...medicationForm.register('name')} />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      error={medicationForm.formState.errors.dosageAmount?.message}
                      label="Dosis"
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
                      label="Stock"
                      type="number"
                      {...medicationForm.register('stockQuantity')}
                    />
                    <TextField
                      error={medicationForm.formState.errors.lowStockThreshold?.message}
                      label="Umbral bajo"
                      type="number"
                      {...medicationForm.register('lowStockThreshold')}
                    />
                  </div>
                  <TextField
                    error={medicationForm.formState.errors.expirationDate?.message}
                    label="Expiracion"
                    type="date"
                    {...medicationForm.register('expirationDate')}
                  />
                  <Button className="w-full" isLoading={registerMedicationMutation.isPending} type="submit">
                    <Pill className="h-4 w-4" aria-hidden="true" />
                    Guardar y crear horario
                  </Button>
                </form>
              ) : null}

              {activeStep === 'schedule' ? (
                <form
                  className="space-y-4"
                  onSubmit={scheduleForm.handleSubmit((values) =>
                    submitMutation(() => createScheduleMutation.mutateAsync(values)),
                  )}
                >
                  <SelectField
                    error={scheduleForm.formState.errors.medicationId?.message}
                    label="Medicamento"
                    options={[{ label: 'Seleccione', value: 0 }, ...medicationOptions]}
                    {...scheduleForm.register('medicationId')}
                  />
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
                      label="Inicio"
                      type="date"
                      {...scheduleForm.register('startDate')}
                    />
                    <TextField
                      error={scheduleForm.formState.errors.endDate?.message}
                      label="Fin"
                      type="date"
                      {...scheduleForm.register('endDate')}
                    />
                  </div>
                  <Button className="w-full" isLoading={createScheduleMutation.isPending} type="submit">
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    Guardar y registrar dosis
                  </Button>
                </form>
              ) : null}

              {activeStep === 'dose' ? (
                <form className="space-y-4">
                  <SelectField
                    error={doseForm.formState.errors.medicationId?.message}
                    label="Medicamento"
                    options={[{ label: 'Seleccione', value: 0 }, ...medicationOptions]}
                    {...doseForm.register('medicationId')}
                  />
                  <SelectField
                    disabled={!doseScheduleOptions.length}
                    error={doseForm.formState.errors.scheduleId?.message}
                    label="Horario"
                    options={[
                      {
                        label: doseScheduleOptions.length ? 'Seleccione' : 'Crea un horario primero',
                        value: 0,
                      },
                      ...doseScheduleOptions,
                    ]}
                    {...doseForm.register('scheduleId')}
                  />
                  <TextField
                    error={doseForm.formState.errors.occurredAt?.message}
                    label="Fecha"
                    type="datetime-local"
                    {...doseForm.register('occurredAt')}
                  />
                  <TextareaField error={doseForm.formState.errors.notes?.message} label="Notas" {...doseForm.register('notes')} />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      isLoading={recordDoseMutation.isPending}
                      onClick={doseForm.handleSubmit((values) =>
                        submitMutation(() => recordDoseMutation.mutateAsync(values)),
                      )}
                      type="button"
                    >
                      <Syringe className="h-4 w-4" aria-hidden="true" />
                      Administrar
                    </Button>
                    <Button
                      isLoading={skipDoseMutation.isPending}
                      onClick={doseForm.handleSubmit((values) =>
                        submitMutation(() => skipDoseMutation.mutateAsync(values)),
                      )}
                      type="button"
                      variant="secondary"
                    >
                      Saltar
                    </Button>
                  </div>
                </form>
              ) : null}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Alertas" title="Stock bajo" />
            <PanelBody>
              {lowStockQuery.data?.length ? (
                <div className="space-y-2">
                  {lowStockQuery.data.map((alert) => (
                    <div key={alert.medicationId} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                      {alert.medicationName}: {alert.currentStock}/{alert.threshold}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Sin alertas de stock" />
              )}
            </PanelBody>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader eyebrow="Dashboard" title="Medicaciones activas" />
            <PanelBody>
              {dashboardLoading ? (
                <LoadingBlock />
              ) : allMedications.length ? (
                <table className="clinical-table">
                  <thead>
                    <tr>
                      <th>Paciente</th>
                      <th>Medicamento</th>
                      <th>Dosis</th>
                      <th>Stock</th>
                      <th>Expira</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allMedications.map(({ medication, patient }) => (
                      <tr key={medication.id}>
                        <td>{patient.fullName}</td>
                        <td className="font-semibold">{medication.name}</td>
                        <td>
                          {medication.dosageAmount} {medication.dosageUnit} - {enumLabel(medication.administrationRoute)}
                        </td>
                        <td>
                          <StatusBadge tone={medication.stockQuantity <= medication.lowStockThreshold ? 'amber' : 'emerald'}>
                            {String(medication.stockQuantity)}
                          </StatusBadge>
                        </td>
                        <td>{formatDate(medication.expirationDate)}</td>
                        <td>
                          <Button onClick={() => startEdit(medication)} size="sm" variant="secondary">
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Editar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState title="Sin medicaciones activas" />
              )}
            </PanelBody>
          </Panel>

          {editingMedicationId ? (
            <Panel>
              <PanelHeader eyebrow="Edicion" title="Editar medicacion" />
              <PanelBody>
                <form
                  className="grid grid-cols-4 gap-3"
                  onSubmit={editForm.handleSubmit((values) =>
                    submitMutation(() => updateMedicationMutation.mutateAsync(values)),
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
                    label="Umbral bajo"
                    type="number"
                    {...editForm.register('lowStockThreshold')}
                  />
                  <TextField
                    error={editForm.formState.errors.expirationDate?.message}
                    label="Expiracion"
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

          <Panel>
            <PanelHeader eyebrow="Horarios" title="Horarios del paciente seleccionado" />
            <PanelBody>
              {selectedPatientSchedules.length ? (
                <table className="clinical-table">
                  <thead>
                    <tr>
                      <th>Medicamento</th>
                      <th>Frecuencia</th>
                      <th>Hora</th>
                      <th>Inicio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPatientSchedules.map((schedule) => {
                      const medication = selectedPatientMedications.find((item) => item.id === schedule.medicationId)
                      return (
                        <tr key={schedule.id}>
                          <td>{medication?.name ?? 'Medicamento'}</td>
                          <td>{enumLabel(schedule.frequencyType)}</td>
                          <td>{schedule.administrationTime}</td>
                          <td>{formatDate(schedule.startDate)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <EmptyState title="Sin horarios activos para el paciente seleccionado" />
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  )
}

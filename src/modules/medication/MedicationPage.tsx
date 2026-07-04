import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Pill, Syringe } from 'lucide-react'
import { z } from 'zod'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { medicationApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { FormError } from '@/shared/components/FormError'
import { SelectField, TextareaField, TextField } from '@/shared/components/FormControls'
import { LoadingBlock } from '@/shared/components/LoadingBlock'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { ensureLocalDateTimeSeconds, formatDate, nowDateTimeInput, todayDateInput } from '@/shared/utils/format'
import { enumLabel } from '@/shared/utils/labels'
import { usePatientRoute } from '@/modules/patients/usePatientRoute'

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

const stockSchema = z.object({
  medicationId: z.coerce.number().int().positive('Medicamento requerido'),
  stockQuantity: z.coerce.number().int().min(0),
})

type MedicationFormInput = z.input<typeof medicationSchema>
type MedicationForm = z.output<typeof medicationSchema>
type ScheduleFormInput = z.input<typeof scheduleSchema>
type ScheduleForm = z.output<typeof scheduleSchema>
type DoseFormInput = z.input<typeof doseSchema>
type DoseForm = z.output<typeof doseSchema>
type StockFormInput = z.input<typeof stockSchema>
type StockForm = z.output<typeof stockSchema>

export function MedicationPage() {
  const { patient, patientId, patientQuery } = usePatientRoute()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const medicationForm = useForm<MedicationFormInput, unknown, MedicationForm>({
    resolver: zodResolver(medicationSchema),
    defaultValues: {
      administrationRoute: 'ORAL',
      dosageAmount: 0,
      dosageUnit: 'MG',
      expirationDate: todayDateInput(),
      lowStockThreshold: 5,
      name: '',
      stockQuantity: 0,
    },
  })
  const scheduleForm = useForm<ScheduleFormInput, unknown, ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      administrationTime: '08:00',
      endDate: '',
      frequencyType: 'DAILY',
      medicationId: 0,
      startDate: todayDateInput(),
      timesPerDay: 1,
    },
  })
  const doseForm = useForm<DoseFormInput, unknown, DoseForm>({
    resolver: zodResolver(doseSchema),
    defaultValues: {
      medicationId: 0,
      notes: '',
      occurredAt: nowDateTimeInput(),
      scheduleId: 0,
    },
  })
  const stockForm = useForm<StockFormInput, unknown, StockForm>({
    resolver: zodResolver(stockSchema),
    defaultValues: {
      medicationId: 0,
      stockQuantity: 0,
    },
  })

  const medicationsQuery = useQuery({
    enabled: Boolean(patientId),
    queryFn: () => medicationApi.listPatientMedications(patientId),
    queryKey: ['medications', patientId],
  })
  const schedulesQuery = useQuery({
    enabled: Boolean(patientId),
    queryFn: () => medicationApi.listActiveSchedules(patientId),
    queryKey: ['medication-schedules', patientId],
  })
  const lowStockQuery = useQuery({
    enabled: Boolean(patientId),
    queryFn: () => medicationApi.listLowStock(patientId),
    queryKey: ['low-stock', patientId],
  })

  const medicationOptions =
    medicationsQuery.data?.map((medication) => ({
      label: `${medication.id} - ${medication.name}`,
      value: medication.id,
    })) ?? []
  const scheduleOptions =
    schedulesQuery.data?.map((schedule) => ({
      label: `${schedule.id} - ${schedule.medicationId} ${schedule.administrationTime}`,
      value: schedule.id,
    })) ?? []

  const registerMedicationMutation = useMutation({
    mutationFn: (values: MedicationForm) =>
      medicationApi.registerMedication({
        ...values,
        patientId,
      }),
    onSuccess: () => {
      medicationForm.reset({
        administrationRoute: 'ORAL',
        dosageAmount: 0,
        dosageUnit: 'MG',
        expirationDate: todayDateInput(),
        lowStockThreshold: 5,
        name: '',
        stockQuantity: 0,
      })
      void queryClient.invalidateQueries({ queryKey: ['medications', patientId] })
      void queryClient.invalidateQueries({ queryKey: ['low-stock', patientId] })
    },
  })

  const createScheduleMutation = useMutation({
    mutationFn: (values: ScheduleForm) =>
      medicationApi.createSchedule({
        administrationTime: values.administrationTime,
        endDate: values.endDate || null,
        frequencyType: values.frequencyType,
        medicationId: values.medicationId,
        patientId,
        startDate: values.startDate,
        timesPerDay: values.timesPerDay,
      }),
    onSuccess: () => {
      scheduleForm.reset({
        administrationTime: '08:00',
        endDate: '',
        frequencyType: 'DAILY',
        medicationId: 0,
        startDate: todayDateInput(),
        timesPerDay: 1,
      })
      void queryClient.invalidateQueries({ queryKey: ['medication-schedules', patientId] })
    },
  })

  const recordDoseMutation = useMutation({
    mutationFn: (values: DoseForm) =>
      medicationApi.recordDose({
        administeredAt: ensureLocalDateTimeSeconds(values.occurredAt),
        medicationId: values.medicationId,
        notes: values.notes ?? '',
        patientId,
        scheduleId: values.scheduleId,
      }),
    onSuccess: () => {
      doseForm.reset({
        medicationId: 0,
        notes: '',
        occurredAt: nowDateTimeInput(),
        scheduleId: 0,
      })
      void queryClient.invalidateQueries({ queryKey: ['medications', patientId] })
      void queryClient.invalidateQueries({ queryKey: ['low-stock', patientId] })
    },
  })

  const skipDoseMutation = useMutation({
    mutationFn: (values: DoseForm) =>
      medicationApi.skipDose({
        medicationId: values.medicationId,
        patientId,
        reason: values.notes ?? '',
        scheduleId: values.scheduleId,
        skippedAt: ensureLocalDateTimeSeconds(values.occurredAt),
      }),
  })

  const updateStockMutation = useMutation({
    mutationFn: (values: StockForm) =>
      medicationApi.updateStock(values.medicationId, {
        stockQuantity: values.stockQuantity,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['medications', patientId] })
      void queryClient.invalidateQueries({ queryKey: ['low-stock', patientId] })
    },
  })

  async function submitMutation<T>(runner: () => Promise<T>) {
    setError(null)
    try {
      await runner()
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  if (patientQuery.isLoading) return <LoadingBlock />

  return (
    <>
      <PageHeader eyebrow="Paciente activo" title={`Medicacion - ${patient?.fullName ?? ''}`} />
      <FormError message={error} />

      <div className="grid grid-cols-[420px_1fr] gap-6">
        <div className="space-y-6">
          <Panel>
            <PanelHeader eyebrow="Medication" title="Registrar medicamento" />
            <PanelBody>
              <form className="space-y-4" onSubmit={medicationForm.handleSubmit((values) => submitMutation(() => registerMedicationMutation.mutateAsync(values)))}>
                <TextField error={medicationForm.formState.errors.name?.message} label="Nombre" {...medicationForm.register('name')} />
                <div className="grid grid-cols-2 gap-3">
                  <TextField error={medicationForm.formState.errors.dosageAmount?.message} label="Dosis" type="number" step="0.01" {...medicationForm.register('dosageAmount')} />
                  <SelectField
                    error={medicationForm.formState.errors.dosageUnit?.message}
                    label="Unidad"
                    options={['MG', 'ML', 'TABLET', 'CAPSULE', 'DROP', 'UNIT'].map((value) => ({ label: value, value }))}
                    {...medicationForm.register('dosageUnit')}
                  />
                </div>
                <SelectField
                  error={medicationForm.formState.errors.administrationRoute?.message}
                  label="Via"
                  options={['ORAL', 'IV', 'IM', 'SUBCUTANEOUS', 'TOPICAL'].map((value) => ({ label: enumLabel(value), value }))}
                  {...medicationForm.register('administrationRoute')}
                />
                <div className="grid grid-cols-2 gap-3">
                  <TextField error={medicationForm.formState.errors.stockQuantity?.message} label="Stock" type="number" {...medicationForm.register('stockQuantity')} />
                  <TextField error={medicationForm.formState.errors.lowStockThreshold?.message} label="Umbral bajo" type="number" {...medicationForm.register('lowStockThreshold')} />
                </div>
                <TextField error={medicationForm.formState.errors.expirationDate?.message} label="Expiracion" type="date" {...medicationForm.register('expirationDate')} />
                <Button className="w-full" isLoading={registerMedicationMutation.isPending} type="submit">
                  <Pill className="h-4 w-4" aria-hidden="true" />
                  Registrar
                </Button>
              </form>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Schedule" title="Crear horario" />
            <PanelBody>
              <form className="space-y-4" onSubmit={scheduleForm.handleSubmit((values) => submitMutation(() => createScheduleMutation.mutateAsync(values)))}>
                <SelectField error={scheduleForm.formState.errors.medicationId?.message} label="Medicamento" options={[{ label: 'Seleccione', value: 0 }, ...medicationOptions]} {...scheduleForm.register('medicationId')} />
                <SelectField
                  error={scheduleForm.formState.errors.frequencyType?.message}
                  label="Frecuencia"
                  options={['DAILY', 'TWICE_DAILY', 'WEEKLY', 'AS_NEEDED'].map((value) => ({ label: enumLabel(value), value }))}
                  {...scheduleForm.register('frequencyType')}
                />
                <div className="grid grid-cols-2 gap-3">
                  <TextField error={scheduleForm.formState.errors.timesPerDay?.message} label="Veces por dia" type="number" {...scheduleForm.register('timesPerDay')} />
                  <TextField error={scheduleForm.formState.errors.administrationTime?.message} label="Hora" type="time" {...scheduleForm.register('administrationTime')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TextField error={scheduleForm.formState.errors.startDate?.message} label="Inicio" type="date" {...scheduleForm.register('startDate')} />
                  <TextField error={scheduleForm.formState.errors.endDate?.message} label="Fin" type="date" {...scheduleForm.register('endDate')} />
                </div>
                <Button className="w-full" isLoading={createScheduleMutation.isPending} type="submit" variant="secondary">
                  Crear horario
                </Button>
              </form>
            </PanelBody>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader eyebrow="Inventario" title="Medicamentos" />
            <PanelBody>
              {medicationsQuery.isLoading ? (
                <LoadingBlock />
              ) : medicationsQuery.data?.length ? (
                <table className="clinical-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Medicamento</th>
                      <th>Dosis</th>
                      <th>Stock</th>
                      <th>Expira</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicationsQuery.data.map((medication) => (
                      <tr key={medication.id}>
                        <td>{medication.id}</td>
                        <td className="font-semibold">{medication.name}</td>
                        <td>
                          {medication.dosageAmount} {medication.dosageUnit} · {enumLabel(medication.administrationRoute)}
                        </td>
                        <td>{medication.stockQuantity}</td>
                        <td>{formatDate(medication.expirationDate)}</td>
                        <td>
                          <StatusBadge tone={medication.active ? 'emerald' : 'slate'}>
                            {medication.active ? 'Activo' : 'Inactivo'}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState title="Sin medicamentos registrados" />
              )}
            </PanelBody>
          </Panel>

          <div className="grid grid-cols-2 gap-6">
            <Panel>
              <PanelHeader eyebrow="Dose" title="Dosis" />
              <PanelBody>
                <form className="space-y-4">
                  <SelectField error={doseForm.formState.errors.medicationId?.message} label="Medicamento" options={[{ label: 'Seleccione', value: 0 }, ...medicationOptions]} {...doseForm.register('medicationId')} />
                  <SelectField error={doseForm.formState.errors.scheduleId?.message} label="Horario" options={[{ label: 'Seleccione', value: 0 }, ...scheduleOptions]} {...doseForm.register('scheduleId')} />
                  <TextField error={doseForm.formState.errors.occurredAt?.message} label="Fecha" type="datetime-local" {...doseForm.register('occurredAt')} />
                  <TextareaField error={doseForm.formState.errors.notes?.message} label="Notas" {...doseForm.register('notes')} />
                  <div className="grid grid-cols-2 gap-2">
                    <Button isLoading={recordDoseMutation.isPending} onClick={doseForm.handleSubmit((values) => submitMutation(() => recordDoseMutation.mutateAsync(values)))} type="button">
                      <Syringe className="h-4 w-4" aria-hidden="true" />
                      Administrar
                    </Button>
                    <Button isLoading={skipDoseMutation.isPending} onClick={doseForm.handleSubmit((values) => submitMutation(() => skipDoseMutation.mutateAsync(values)))} type="button" variant="secondary">
                      Saltar
                    </Button>
                  </div>
                </form>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Stock" title="Actualizar stock" />
              <PanelBody className="space-y-4">
                <form className="space-y-4" onSubmit={stockForm.handleSubmit((values) => submitMutation(() => updateStockMutation.mutateAsync(values)))}>
                  <SelectField error={stockForm.formState.errors.medicationId?.message} label="Medicamento" options={[{ label: 'Seleccione', value: 0 }, ...medicationOptions]} {...stockForm.register('medicationId')} />
                  <TextField error={stockForm.formState.errors.stockQuantity?.message} label="Nuevo stock" type="number" {...stockForm.register('stockQuantity')} />
                  <Button className="w-full" isLoading={updateStockMutation.isPending} type="submit" variant="secondary">
                    Guardar stock
                  </Button>
                </form>
                {lowStockQuery.data?.length ? (
                  <div className="space-y-2">
                    {lowStockQuery.data.map((alert) => (
                      <div key={alert.medicationId} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                        {alert.medicationName}: {alert.currentStock}/{alert.threshold}
                      </div>
                    ))}
                  </div>
                ) : null}
              </PanelBody>
            </Panel>
          </div>

          <Panel>
            <PanelHeader eyebrow="Schedule" title="Horarios activos" />
            <PanelBody>
              {schedulesQuery.data?.length ? (
                <table className="clinical-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Medicamento</th>
                      <th>Frecuencia</th>
                      <th>Hora</th>
                      <th>Inicio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedulesQuery.data.map((schedule) => (
                      <tr key={schedule.id}>
                        <td>{schedule.id}</td>
                        <td>{schedule.medicationId}</td>
                        <td>{enumLabel(schedule.frequencyType)}</td>
                        <td>{schedule.administrationTime}</td>
                        <td>{formatDate(schedule.startDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState title="Sin horarios activos" />
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  )
}

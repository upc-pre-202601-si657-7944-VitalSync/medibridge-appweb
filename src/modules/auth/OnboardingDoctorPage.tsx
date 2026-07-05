import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { CreditCard, UserRoundCheck } from 'lucide-react'
import { z } from 'zod'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { paymentsApi, profilesApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { FormError } from '@/shared/components/FormError'
import { SelectField, TextField } from '@/shared/components/FormControls'
import { LoadingBlock } from '@/shared/components/LoadingBlock'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { useAuth } from '@/modules/auth/useAuth'
import {
  getClinicalWorkspace,
  hasCompleteDoctorProfile,
  saveDoctorProfile,
} from '@/shared/utils/clinicalWorkspace'
import { formatDate } from '@/shared/utils/format'

const doctorSchema = z.object({
  fullName: z.string().min(3, 'Nombre requerido'),
})

const subscriptionSchema = z.object({
  billingCycle: z.enum(['MONTHLY', 'ANNUALLY']),
  planType: z.enum(['INSTITUTION_BASIC', 'INSTITUTION_PREMIUM']),
})

type DoctorForm = z.infer<typeof doctorSchema>
type SubscriptionForm = z.infer<typeof subscriptionSchema>

export function OnboardingDoctorPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState(() => getClinicalWorkspace(user?.id))
  const hasDoctorProfile = hasCompleteDoctorProfile(workspace, user?.id)

  const doctorForm = useForm<DoctorForm>({
    resolver: zodResolver(doctorSchema),
    defaultValues: { fullName: workspace.doctorProfile?.fullName ?? '' },
  })
  const subscriptionForm = useForm<SubscriptionForm>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: { billingCycle: 'MONTHLY', planType: 'INSTITUTION_BASIC' },
  })

  const currentDoctorQuery = useQuery({
    enabled: Boolean(user?.id),
    queryFn: profilesApi.getCurrentDoctor,
    queryKey: ['current-doctor-profile', user?.id],
    retry: false,
  })

  const activeSubscriptionQuery = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => paymentsApi.getActiveSubscription(user!.id),
    queryKey: ['active-subscription', user?.id],
    retry: false,
  })

  useEffect(() => {
    if (!currentDoctorQuery.data) return
    saveDoctorProfile(currentDoctorQuery.data)
    setWorkspace(getClinicalWorkspace(user?.id))
    doctorForm.reset({ fullName: currentDoctorQuery.data.fullName })
  }, [currentDoctorQuery.data, doctorForm, user?.id])

  const createDoctorMutation = useMutation({
    mutationFn: profilesApi.createDoctor,
    onSuccess: (doctorProfile) => {
      saveDoctorProfile(doctorProfile)
      setWorkspace(getClinicalWorkspace(user?.id))
      void queryClient.invalidateQueries({ queryKey: ['current-doctor-profile', user?.id] })
    },
  })

  const checkoutMutation = useMutation({
    mutationFn: paymentsApi.createCheckoutSession,
    onSuccess: (checkout) => {
      window.location.assign(checkout.checkoutUrl)
    },
  })

  async function createDoctor(values: DoctorForm) {
    setError(null)
    try {
      await createDoctorMutation.mutateAsync(values)
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  async function startCheckout(values: SubscriptionForm) {
    if (!user || !hasDoctorProfile) return
    setError(null)
    try {
      await checkoutMutation.mutateAsync({
        billingCycle: values.billingCycle,
        commercialLine: 'INSTITUTION',
        planType: values.planType,
        userId: user.id,
      })
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  return (
    <>
      <PageHeader
        actions={
          <Button disabled={!hasDoctorProfile} onClick={() => navigate('/patients')}>
            Continuar
          </Button>
        }
        eyebrow="Onboarding"
        title="Completa tu perfil medico"
      />

      <FormError message={error} />

      <div className="grid grid-cols-[1.1fr_0.9fr] gap-6">
        <Panel>
          <PanelHeader eyebrow="Perfil medico" title="Datos del doctor" />
          <PanelBody className="space-y-6">
            {currentDoctorQuery.isLoading ? <LoadingBlock /> : null}

            <form
              className="grid grid-cols-[1fr_auto] items-end gap-3"
              onSubmit={doctorForm.handleSubmit(createDoctor)}
            >
              <TextField
                disabled={hasDoctorProfile}
                error={doctorForm.formState.errors.fullName?.message}
                label="Nombre completo"
                {...doctorForm.register('fullName')}
              />
              <Button disabled={hasDoctorProfile} isLoading={createDoctorMutation.isPending} type="submit">
                <UserRoundCheck className="h-4 w-4" aria-hidden="true" />
                Crear perfil
              </Button>
            </form>

            {workspace.doctorProfile ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Perfil listo</p>
                <p className="mt-1 text-sm font-bold text-emerald-900">{workspace.doctorProfile.fullName}</p>
                <p className="mt-1 text-xs font-semibold text-emerald-800">
                  Vinculado automaticamente al usuario {user?.username}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                Crea tu perfil medico para entrar al resto de la aplicacion.
              </div>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Payments" title="Suscripcion institucional" />
          <PanelBody className="space-y-5">
            {activeSubscriptionQuery.data ? (
              <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-bold text-slate-950">{activeSubscriptionQuery.data.plan.displayName}</p>
                  <StatusBadge tone="emerald">{activeSubscriptionQuery.data.status}</StatusBadge>
                </div>
                <p className="text-sm font-semibold text-slate-600">
                  Fin de periodo: {formatDate(activeSubscriptionQuery.data.currentPeriodEnd)}
                </p>
              </div>
            ) : null}

            <form className="space-y-4" onSubmit={subscriptionForm.handleSubmit(startCheckout)}>
              <SelectField
                error={subscriptionForm.formState.errors.planType?.message}
                label="Plan"
                options={[
                  { label: 'Institution Basic', value: 'INSTITUTION_BASIC' },
                  { label: 'Institution Premium', value: 'INSTITUTION_PREMIUM' },
                ]}
                {...subscriptionForm.register('planType')}
              />
              <SelectField
                error={subscriptionForm.formState.errors.billingCycle?.message}
                label="Facturacion"
                options={[
                  { label: 'Mensual', value: 'MONTHLY' },
                  { label: 'Anual', value: 'ANNUALLY' },
                ]}
                {...subscriptionForm.register('billingCycle')}
              />
              <Button disabled={!hasDoctorProfile} isLoading={checkoutMutation.isPending} type="submit">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Ir a Stripe
              </Button>
            </form>
          </PanelBody>
        </Panel>
      </div>
    </>
  )
}

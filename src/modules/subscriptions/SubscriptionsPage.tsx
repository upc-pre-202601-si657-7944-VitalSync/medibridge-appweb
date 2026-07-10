import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { UseFormReturn } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2, CreditCard, RefreshCw, ShieldCheck, Star, XCircle } from 'lucide-react'
import { z } from 'zod'
import { env } from '@/config/env'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { paymentsApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { FormError } from '@/shared/components/FormError'
import { LoadingBlock } from '@/shared/components/LoadingBlock'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { useAuth } from '@/modules/auth/useAuth'
import { formatCurrency, formatDate, formatDateTime } from '@/shared/utils/format'
import { enumLabel, statusTone } from '@/shared/utils/labels'

const subscriptionSchema = z.object({
  billingCycle: z.enum(['MONTHLY', 'ANNUALLY']),
  planType: z.enum(['INSTITUTION_BASIC', 'INSTITUTION_PREMIUM']),
})

type SubscriptionForm = z.infer<typeof subscriptionSchema>

function getCheckoutReturnUrl() {
  return window.location.origin
}

export function SubscriptionsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const checkoutStatus = searchParams.get('checkout')
  const checkoutSessionId = searchParams.get('session_id')
  const confirmingSessionRef = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mockMessage, setMockMessage] = useState<string | null>(null)
  const form = useForm<SubscriptionForm>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      billingCycle: 'MONTHLY',
      planType: 'INSTITUTION_BASIC',
    },
  })

  const activeSubscriptionQuery = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => paymentsApi.getActiveSubscription(user!.id),
    queryKey: ['active-subscription', user?.id],
    retry: false,
  })
  const subscriptionsQuery = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => paymentsApi.listSubscriptions(user!.id),
    queryKey: ['subscriptions', user?.id],
    retry: false,
  })
  const invoicesQuery = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => paymentsApi.listInvoices(user!.id),
    queryKey: ['invoices', user?.id],
    retry: false,
  })

  const checkoutMutation = useMutation({
    mutationFn: paymentsApi.createCheckoutSession,
    onSuccess: (checkout) => {
      window.location.assign(checkout.checkoutUrl)
    },
  })

  const confirmCheckoutMutation = useMutation({
    mutationFn: paymentsApi.confirmCheckoutSession,
    onSuccess: () => {
      setMockMessage('Pago confirmado por Stripe. La suscripcion quedo activa.')
      void queryClient.invalidateQueries({ queryKey: ['active-subscription', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['subscriptions', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['invoices', user?.id] })
      setSearchParams({}, { replace: true })
    },
    onError: (submitError) => {
      setError(getApiErrorMessage(submitError))
    },
  })

  const approveMockSubscriptionMutation = useMutation({
    mutationFn: paymentsApi.approveMockSubscription,
    onSuccess: () => {
      setMockMessage('Pago mock aprobado. La suscripcion quedo activa localmente.')
      void queryClient.invalidateQueries({ queryKey: ['active-subscription', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['subscriptions', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['invoices', user?.id] })
    },
  })

  const cancelSubscriptionMutation = useMutation({
    mutationFn: paymentsApi.cancelSubscription,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['active-subscription', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['subscriptions', user?.id] })
    },
  })

  const renewSubscriptionMutation = useMutation({
    mutationFn: paymentsApi.renewSubscription,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['active-subscription', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['subscriptions', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['invoices', user?.id] })
    },
  })

  useEffect(() => {
    if (checkoutStatus !== 'success' || !user?.id) return
    if (!checkoutSessionId) {
      void queryClient.invalidateQueries({ queryKey: ['active-subscription', user.id] })
      void queryClient.invalidateQueries({ queryKey: ['subscriptions', user.id] })
      void queryClient.invalidateQueries({ queryKey: ['invoices', user.id] })
      setSearchParams({}, { replace: true })
      return
    }
    if (confirmingSessionRef.current === checkoutSessionId) return
    if (confirmCheckoutMutation.isPending) return
    confirmingSessionRef.current = checkoutSessionId
    confirmCheckoutMutation.mutate({ sessionId: checkoutSessionId })
  }, [
    checkoutSessionId,
    checkoutStatus,
    confirmCheckoutMutation,
    queryClient,
    setSearchParams,
    user?.id,
  ])

  async function runAction(action: () => Promise<unknown>) {
    setError(null)
    setMockMessage(null)
    try {
      await action()
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  async function startCheckout(values: SubscriptionForm) {
    if (!user) return
    setMockMessage(null)
    await runAction(() =>
      checkoutMutation.mutateAsync({
        billingCycle: values.billingCycle,
        commercialLine: 'INSTITUTION',
        planType: values.planType,
        returnUrl: getCheckoutReturnUrl(),
        userId: user.id,
      }),
    )
  }

  async function approveMockPayment() {
    if (!user) return
    const values = form.getValues()
    setMockMessage(null)
    await runAction(() =>
      approveMockSubscriptionMutation.mutateAsync({
        billingCycle: values.billingCycle,
        commercialLine: 'INSTITUTION',
        planType: values.planType,
        userId: user.id,
      }),
    )
  }

  function rejectMockPayment() {
    setMockMessage(null)
    setError('Pago mock rechazado: fondos insuficientes. Usa este caso para probar estados de error.')
  }

  return (
    <>
      <PageHeader eyebrow="Pagos & Planes" title="Suscripcion institucional" />
      <FormError message={error} />
      {checkoutStatus === 'cancelled' ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Checkout cancelado. Puedes volver a intentarlo cuando quieras.
        </div>
      ) : null}
      {mockMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          {mockMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-[420px_1fr] gap-6">
        <Panel>
          <PanelHeader eyebrow="Nuevo plan" title="Comprar o mejorar plan" />
          <PanelBody>
            <form className="space-y-4" onSubmit={form.handleSubmit(startCheckout)}>
              <PlanSelector form={form} />
              <BillingCycleSelector form={form} />
              <Button className="w-full" isLoading={checkoutMutation.isPending} type="submit">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Continuar con Stripe
              </Button>

              {env.enablePaymentMocks ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Modo dev
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      isLoading={approveMockSubscriptionMutation.isPending}
                      onClick={approveMockPayment}
                      type="button"
                      variant="secondary"
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Aprobar
                    </Button>
                    <Button onClick={rejectMockPayment} type="button" variant="secondary">
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      Rechazar
                    </Button>
                  </div>
                </div>
              ) : null}
            </form>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Estado actual" title="Suscripcion activa" />
          <PanelBody>
            {activeSubscriptionQuery.isLoading ? (
              <LoadingBlock />
            ) : activeSubscriptionQuery.data ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-slate-50 p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Plan activo</p>
                      <h2 className="mt-0.5 text-2xl font-bold text-slate-950">
                        {activeSubscriptionQuery.data.plan.displayName}
                      </h2>
                    </div>
                    <StatusBadge tone={statusTone(activeSubscriptionQuery.data.status)}>
                      {activeSubscriptionQuery.data.status}
                    </StatusBadge>
                  </div>
                  <p className="text-lg font-bold text-teal-700">
                    {formatCurrency(activeSubscriptionQuery.data.plan.price, activeSubscriptionQuery.data.plan.currency)}
                    <span className="ml-1 text-sm font-semibold text-slate-500">
                      / {enumLabel(activeSubscriptionQuery.data.plan.billingCycle ?? activeSubscriptionQuery.data.plan.planType)}
                    </span>
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="text-xs font-semibold uppercase tracking-wide">Inicio</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{formatDate(activeSubscriptionQuery.data.startedAt)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="text-xs font-semibold uppercase tracking-wide">Vencimiento</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{formatDate(activeSubscriptionQuery.data.currentPeriodEnd)}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                  <Button
                    isLoading={cancelSubscriptionMutation.isPending}
                    onClick={() =>
                      runAction(() => cancelSubscriptionMutation.mutateAsync(activeSubscriptionQuery.data.id))
                    }
                    variant="danger"
                    size="sm"
                  >
                    Cancelar suscripcion
                  </Button>
                  <Button
                    isLoading={renewSubscriptionMutation.isPending}
                    onClick={() => runAction(() => renewSubscriptionMutation.mutateAsync(activeSubscriptionQuery.data.id))}
                    variant="secondary"
                    size="sm"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Renovar
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState title="Sin suscripcion activa" />
            )}
          </PanelBody>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Panel>
          <PanelHeader eyebrow="Historial" title="Suscripciones" />
          <PanelBody>
            {subscriptionsQuery.data?.length ? (
              <table className="clinical-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Plan</th>
                    <th>Estado</th>
                    <th>Periodo</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionsQuery.data.map((subscription) => (
                    <tr key={subscription.id}>
                        <td className="font-mono text-xs text-slate-500">#{subscription.id}</td>
                      <td>{subscription.plan.displayName}</td>
                      <td>
                        <StatusBadge tone={statusTone(subscription.status)}>{subscription.status}</StatusBadge>
                      </td>
                      <td>{formatDate(subscription.currentPeriodEnd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState title="Sin historial de suscripciones" />
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Invoices" title="Facturas" />
          <PanelBody>
            {invoicesQuery.data?.length ? (
              <table className="clinical-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Monto</th>
                    <th>Estado</th>
                    <th>Emision</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesQuery.data.map((invoice) => (
                    <tr key={invoice.id}>
                        <td className="font-mono text-xs text-slate-500">#{invoice.id}</td>
                      <td>{formatCurrency(invoice.amount, invoice.currency)}</td>
                      <td>
                        <StatusBadge tone={statusTone(invoice.status)}>{invoice.status}</StatusBadge>
                      </td>
                      <td>{formatDateTime(invoice.issuedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState title="Sin facturas registradas" />
            )}
          </PanelBody>
        </Panel>
      </div>
    </>
  )
}

function PlanSelector({ form }: { form: UseFormReturn<SubscriptionForm> }) {
  const selected = useWatch({ control: form.control, name: 'planType' })
  const plans: { value: SubscriptionForm['planType']; icon: typeof ShieldCheck; label: string; description: string; premium: boolean }[] = [
    { value: 'INSTITUTION_BASIC', icon: ShieldCheck, label: 'Basic', description: 'Funcionalidades esenciales', premium: false },
    { value: 'INSTITUTION_PREMIUM', icon: Star, label: 'Premium', description: 'Acceso completo y avanzado', premium: true },
  ]
  return (
    <div>
      <p className="field-label mb-1.5">Plan</p>
      <div className="grid grid-cols-2 gap-2">
        {plans.map(({ value, icon: Icon, label, description, premium }) => {
          const active = selected === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => form.setValue('planType', value, { shouldValidate: true })}
              className={[
                'rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2',
                active && premium
                  ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-400'
                  : active
                  ? 'border-slate-400 bg-slate-100 ring-1 ring-slate-300'
                  : 'border-slate-200 bg-white hover:bg-slate-50',
              ].join(' ')}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <Icon className={`h-4 w-4 ${active && premium ? 'text-teal-700' : 'text-slate-500'}`} aria-hidden="true" />
                <span className={`text-xs font-bold ${active && premium ? 'text-teal-800' : 'text-slate-700'}`}>{label}</span>
                {active ? <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-teal-600" aria-hidden="true" /> : null}
              </div>
              <p className={`text-xs ${active && premium ? 'text-teal-700' : 'text-slate-500'}`}>{description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BillingCycleSelector({ form }: { form: UseFormReturn<SubscriptionForm> }) {
  const selected = useWatch({ control: form.control, name: 'billingCycle' })
  const cycles: { value: SubscriptionForm['billingCycle']; label: string; sub: string }[] = [
    { value: 'MONTHLY', label: 'Mensual', sub: 'Pago mes a mes' },
    { value: 'ANNUALLY', label: 'Anual', sub: 'Ahorra hasta 20%' },
  ]
  return (
    <div>
      <p className="field-label mb-1.5">Ciclo de facturacion</p>
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {cycles.map(({ value, label, sub }) => {
          const active = selected === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => form.setValue('billingCycle', value, { shouldValidate: true })}
              className={[
                'flex-1 rounded-md px-3 py-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600',
                active ? 'border border-slate-200 bg-white shadow-sm' : 'hover:bg-white/60',
              ].join(' ')}
            >
              <p className={`text-sm font-bold ${active ? 'text-slate-900' : 'text-slate-500'}`}>{label}</p>
              <p className={`text-xs ${active ? 'font-semibold text-teal-700' : 'text-slate-400'}`}>{sub}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

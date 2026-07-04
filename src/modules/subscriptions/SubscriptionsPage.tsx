import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { CreditCard } from 'lucide-react'
import { z } from 'zod'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { paymentsApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { FormError } from '@/shared/components/FormError'
import { SelectField } from '@/shared/components/FormControls'
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

export function SubscriptionsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
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

  const createSubscriptionMutation = useMutation({
    mutationFn: (values: SubscriptionForm) =>
      paymentsApi.createSubscription({
        billingCycle: values.billingCycle,
        commercialLine: 'INSTITUTION',
        planType: values.planType,
        userId: user!.id,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['active-subscription', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['subscriptions', user?.id] })
    },
  })

  const cancelSubscriptionMutation = useMutation({
    mutationFn: paymentsApi.cancelSubscription,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['active-subscription', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['subscriptions', user?.id] })
    },
  })

  const renewSubscriptionMutation = useMutation({
    mutationFn: paymentsApi.renewSubscription,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['active-subscription', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['subscriptions', user?.id] })
    },
  })

  async function runAction(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  return (
    <>
      <PageHeader eyebrow="Payments" title="Suscripcion institucional" />
      <FormError message={error} />

      <div className="grid grid-cols-[420px_1fr] gap-6">
        <Panel>
          <PanelHeader eyebrow="Plan" title="Crear suscripcion" />
          <PanelBody>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => runAction(() => createSubscriptionMutation.mutateAsync(values)))}>
              <SelectField
                error={form.formState.errors.planType?.message}
                label="Plan"
                options={[
                  { label: 'Institution Basic', value: 'INSTITUTION_BASIC' },
                  { label: 'Institution Premium', value: 'INSTITUTION_PREMIUM' },
                ]}
                {...form.register('planType')}
              />
              <SelectField
                error={form.formState.errors.billingCycle?.message}
                label="Facturacion"
                options={[
                  { label: 'Mensual', value: 'MONTHLY' },
                  { label: 'Anual', value: 'ANNUALLY' },
                ]}
                {...form.register('billingCycle')}
              />
              <Button className="w-full" isLoading={createSubscriptionMutation.isPending} type="submit">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Crear suscripcion
              </Button>
            </form>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Activa" title="Suscripcion actual" />
          <PanelBody>
            {activeSubscriptionQuery.isLoading ? (
              <LoadingBlock />
            ) : activeSubscriptionQuery.data ? (
              <div className="grid grid-cols-[1fr_auto] items-start gap-6">
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-950">{activeSubscriptionQuery.data.plan.displayName}</h2>
                    <StatusBadge tone={statusTone(activeSubscriptionQuery.data.status)}>
                      {activeSubscriptionQuery.data.status}
                    </StatusBadge>
                  </div>
                  <p className="text-sm font-semibold text-slate-600">
                    {enumLabel(activeSubscriptionQuery.data.plan.planType)} · {formatCurrency(activeSubscriptionQuery.data.plan.price, activeSubscriptionQuery.data.plan.currency)}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    Inicio {formatDate(activeSubscriptionQuery.data.startedAt)} · Fin {formatDate(activeSubscriptionQuery.data.currentPeriodEnd)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    isLoading={cancelSubscriptionMutation.isPending}
                    onClick={() => runAction(() => cancelSubscriptionMutation.mutateAsync(activeSubscriptionQuery.data.id))}
                    variant="danger"
                  >
                    Cancelar
                  </Button>
                  <Button
                    isLoading={renewSubscriptionMutation.isPending}
                    onClick={() => runAction(() => renewSubscriptionMutation.mutateAsync(activeSubscriptionQuery.data.id))}
                    variant="secondary"
                  >
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
                      <td>{subscription.id}</td>
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
                      <td>{invoice.id}</td>
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

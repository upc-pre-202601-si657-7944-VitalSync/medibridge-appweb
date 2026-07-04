import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { communicationApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { FormError } from '@/shared/components/FormError'
import { LoadingBlock } from '@/shared/components/LoadingBlock'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { useAuth } from '@/modules/auth/useAuth'
import { formatDateTime } from '@/shared/utils/format'
import { enumLabel, statusTone } from '@/shared/utils/labels'

export function NotificationsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const notificationsQuery = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => communicationApi.listNotifications(user!.id),
    queryKey: ['notifications', user?.id],
  })
  const unreadNotificationsQuery = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => communicationApi.listUnreadNotifications(user!.id),
    queryKey: ['notifications-unread', user?.id],
  })

  const markReadMutation = useMutation({
    mutationFn: communicationApi.markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread', user?.id] })
    },
  })

  async function markRead(notificationId: string) {
    setError(null)
    try {
      await markReadMutation.mutateAsync(notificationId)
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  return (
    <>
      <PageHeader
        actions={<StatusBadge tone="amber">{`${unreadNotificationsQuery.data?.length ?? 0} no leidas`}</StatusBadge>}
        eyebrow="Communication"
        title="Notificaciones"
      />
      <FormError message={error} />

      <Panel>
        <PanelHeader eyebrow="Eventos" title="Bandeja" />
        <PanelBody>
          {notificationsQuery.isLoading ? (
            <LoadingBlock />
          ) : notificationsQuery.data?.length ? (
            <table className="clinical-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Tipo</th>
                  <th>Titulo</th>
                  <th>Paciente</th>
                  <th>Fecha</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {notificationsQuery.data.map((notification) => (
                  <tr key={notification.id}>
                    <td>
                      <StatusBadge tone={statusTone(notification.status)}>
                        {enumLabel(notification.status)}
                      </StatusBadge>
                    </td>
                    <td>{enumLabel(notification.type)}</td>
                    <td>
                      <p className="font-semibold text-slate-900">{notification.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
                    </td>
                    <td>{notification.patientId ?? '-'}</td>
                    <td>{formatDateTime(notification.createdAt)}</td>
                    <td>
                      <Button
                        disabled={notification.status === 'READ'}
                        isLoading={markReadMutation.isPending}
                        onClick={() => markRead(notification.id)}
                        size="sm"
                        variant="secondary"
                      >
                        <CheckCheck className="h-4 w-4" aria-hidden="true" />
                        Leida
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="Sin notificaciones" />
          )}
        </PanelBody>
      </Panel>
    </>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Send } from 'lucide-react'
import { z } from 'zod'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { communicationApi } from '@/shared/api/medibridgeApi'
import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { FormError } from '@/shared/components/FormError'
import { TextareaField, TextField } from '@/shared/components/FormControls'
import { LoadingBlock } from '@/shared/components/LoadingBlock'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel, PanelBody, PanelHeader } from '@/shared/components/Panel'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { useAuth } from '@/modules/auth/useAuth'
import { formatDateTime } from '@/shared/utils/format'
import { getClinicalWorkspace } from '@/shared/utils/clinicalWorkspace'

const recipientSchema = z.object({
  recipientUserId: z.coerce.number().int().positive('Usuario requerido'),
})

const messageSchema = z.object({
  content: z.string().min(1, 'Mensaje requerido'),
})

type RecipientFormInput = z.input<typeof recipientSchema>
type RecipientForm = z.output<typeof recipientSchema>
type MessageForm = z.infer<typeof messageSchema>

export function ChatPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const workspace = getClinicalWorkspace()
  const [recipientUserId, setRecipientUserId] = useState<number | null>(null)
  const [recipientName, setRecipientName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recipientForm = useForm<RecipientFormInput, unknown, RecipientForm>({
    resolver: zodResolver(recipientSchema),
    defaultValues: { recipientUserId: 0 },
  })
  const messageForm = useForm<MessageForm>({
    resolver: zodResolver(messageSchema),
    defaultValues: { content: '' },
  })

  const connectedUsersQuery = useQuery({
    queryFn: communicationApi.listConnectedUsers,
    queryKey: ['connected-users'],
  })
  const conversationQuery = useQuery({
    enabled: Boolean(user?.id && recipientUserId),
    queryFn: () => communicationApi.getConversation(user!.id, recipientUserId!),
    queryKey: ['conversation', user?.id, recipientUserId],
  })

  const connectMutation = useMutation({
    mutationFn: () =>
      communicationApi.connect({
        fullName: workspace.doctorProfile?.fullName ?? user?.username ?? '',
        userId: user!.id,
        username: user!.username,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['connected-users'] })
    },
  })
  const disconnectMutation = useMutation({
    mutationFn: () =>
      communicationApi.disconnect({
        fullName: workspace.doctorProfile?.fullName ?? user?.username ?? '',
        userId: user!.id,
        username: user!.username,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['connected-users'] })
    },
  })
  const sendMessageMutation = useMutation({
    mutationFn: (values: MessageForm) =>
      communicationApi.sendMessage({
        content: values.content,
        recipientUserId: recipientUserId!,
        sentAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      messageForm.reset({ content: '' })
      void queryClient.invalidateQueries({ queryKey: ['conversation', user?.id, recipientUserId] })
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

  function selectRecipient(values: RecipientForm) {
    setRecipientUserId(values.recipientUserId)
    const known = connectedUsersQuery.data?.find((u) => u.userId === values.recipientUserId)
    setRecipientName(known ? (known.fullName || known.username) : null)
  }

  return (
    <>
      <PageHeader
        actions={
          <div className="flex gap-2">
            <Button isLoading={connectMutation.isPending} onClick={() => runAction(() => connectMutation.mutateAsync())} variant="secondary">
              Conectar
            </Button>
            <Button isLoading={disconnectMutation.isPending} onClick={() => runAction(() => disconnectMutation.mutateAsync())} variant="ghost">
              Desconectar
            </Button>
          </div>
        }
        eyebrow="Communication"
        title="Chat"
      />
      <FormError message={error} />

      <div className="grid grid-cols-[360px_1fr] gap-6">
        <Panel>
          <PanelHeader eyebrow="Usuarios" title="Conectados" />
          <PanelBody className="space-y-4">
            <form className="space-y-3" onSubmit={recipientForm.handleSubmit(selectRecipient)}>
              <TextField error={recipientForm.formState.errors.recipientUserId?.message} label="Recipient User ID" type="number" {...recipientForm.register('recipientUserId')} />
              <Button className="w-full" type="submit" variant="secondary">
                Abrir conversacion
              </Button>
            </form>

            {connectedUsersQuery.isLoading ? (
              <LoadingBlock />
            ) : connectedUsersQuery.data?.length ? (
              <div className="space-y-2">
                {connectedUsersQuery.data.map((connectedUser) => (
                  <button
                    className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-teal-300 hover:bg-teal-50"
                    key={connectedUser.id}
                    onClick={() => {
                      setRecipientUserId(connectedUser.userId)
                      setRecipientName(connectedUser.fullName || connectedUser.username)
                      recipientForm.setValue('recipientUserId', connectedUser.userId)
                    }}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-slate-950">{connectedUser.fullName || connectedUser.username}</p>
                      <StatusBadge tone={connectedUser.status === 'ONLINE' ? 'emerald' : 'slate'}>
                        {connectedUser.status}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">User ID {connectedUser.userId}</p>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState title="Sin usuarios conectados" />
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow={recipientName ?? (recipientUserId ? `Usuario ${recipientUserId}` : 'Conversacion')} title="Mensajes" />
          <PanelBody className="space-y-4">
            {conversationQuery.isLoading ? (
              <LoadingBlock />
            ) : conversationQuery.data?.length ? (
              <div className="max-h-[540px] space-y-3 overflow-y-auto pr-2">
                {conversationQuery.data.map((message) => {
                  const ownMessage = message.senderUserId === user?.id
                  return (
                    <div className={`flex ${ownMessage ? 'justify-end' : 'justify-start'}`} key={message.id}>
                      <div className={`max-w-[70%] rounded-lg px-4 py-3 ${ownMessage ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-900'}`}>
                        <p className="text-sm font-semibold">{message.content}</p>
                        <p className={`mt-2 text-xs font-semibold ${ownMessage ? 'text-teal-100' : 'text-slate-500'}`}>
                          {formatDateTime(message.sentAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState title={recipientUserId ? 'Sin mensajes' : 'Sin conversacion abierta'} />
            )}

            <form className="grid grid-cols-[1fr_auto] items-end gap-3" onSubmit={messageForm.handleSubmit((values) => runAction(() => sendMessageMutation.mutateAsync(values)))}>
              <TextareaField error={messageForm.formState.errors.content?.message} label="Mensaje" {...messageForm.register('content')} />
              <Button disabled={!recipientUserId} isLoading={sendMessageMutation.isPending} type="submit">
                <Send className="h-4 w-4" aria-hidden="true" />
                Enviar
              </Button>
            </form>
          </PanelBody>
        </Panel>
      </div>
    </>
  )
}

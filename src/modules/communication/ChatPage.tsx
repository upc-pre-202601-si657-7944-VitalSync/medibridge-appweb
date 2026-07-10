import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { MessageSquare, Send, UserRound, Wifi, WifiOff } from 'lucide-react'
import { z } from 'zod'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { communicationApi, profilesApi } from '@/shared/api/medibridgeApi'
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
import type { ConnectedUser, ProfileChatContact } from '@/shared/types/api'

const recipientSchema = z.object({
  recipientUserId: z.coerce.number().int().positive('Usuario requerido'),
})

const messageSchema = z.object({
  content: z.string().min(1, 'Mensaje requerido'),
})

type RecipientFormInput = z.input<typeof recipientSchema>
type RecipientForm = z.output<typeof recipientSchema>
type MessageForm = z.infer<typeof messageSchema>

type ChatContact = {
  key: string
  name: string
  searchableText: string
  source: 'care-team' | 'connected'
  status: ConnectedUser['status'] | 'UNAVAILABLE'
  subtitle: string
  userId?: number | null
}

function getInitials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function connectedUserContact(connectedUser: ConnectedUser): ChatContact {
  const name = connectedUser.fullName || connectedUser.username
  return {
    key: `user-${connectedUser.userId}`,
    name,
    searchableText: `${name} ${connectedUser.username} ${connectedUser.userId}`.toLowerCase(),
    source: 'connected',
    status: connectedUser.status,
    subtitle: `User ID ${connectedUser.userId} - ${connectedUser.username}`,
    userId: connectedUser.userId,
  }
}

function careTeamContact(contact: ProfileChatContact, connectedUser?: ConnectedUser): ChatContact {
  const typeLabel = contact.contactType === 'DOCTOR' ? 'Medico' : 'Familiar'
  return {
    key: `care-${contact.userId}-${contact.patientId}`,
    name: contact.fullName,
    searchableText: `${contact.fullName} ${contact.patientFullName} ${typeLabel} ${contact.userId}`.toLowerCase(),
    source: 'care-team',
    status: contact.userId ? connectedUser?.status ?? 'OFFLINE' : 'UNAVAILABLE',
    subtitle: `${typeLabel} de ${contact.patientFullName}`,
    userId: contact.userId,
  }
}

export function ChatPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const workspace = getClinicalWorkspace()
  const [recipientUserId, setRecipientUserId] = useState<number | null>(null)
  const [recipientName, setRecipientName] = useState<string | null>(null)
  const [contactSearch, setContactSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedContactKey, setSelectedContactKey] = useState<string | null>(null)
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
    refetchInterval: 10_000,
  })
  const chatContactsQuery = useQuery({
    queryFn: profilesApi.listChatContacts,
    queryKey: ['profile-chat-contacts'],
    retry: false,
  })

  const contacts = useMemo<ChatContact[]>(() => {
    const byKey = new Map<string, ChatContact>()
    const connectedUserByUserId = new Map(
      connectedUsersQuery.data?.map((connectedUser) => [connectedUser.userId, connectedUser]) ?? [],
    )

    chatContactsQuery.data?.forEach((contact) => {
      if (contact.userId === user?.id) return
      byKey.set(
        `care-${contact.userId}-${contact.patientId}`,
        careTeamContact(contact, connectedUserByUserId.get(contact.userId)),
      )
    })

    connectedUsersQuery.data
      ?.filter((connectedUser) => connectedUser.userId !== user?.id)
      .forEach((connectedUser) => {
        const alreadyListed = [...byKey.values()].some((contact) => contact.userId === connectedUser.userId)
        if (!alreadyListed) byKey.set(`user-${connectedUser.userId}`, connectedUserContact(connectedUser))
      })

    return [...byKey.values()].sort((left, right) => {
      if (left.status === 'ONLINE' && right.status !== 'ONLINE') return -1
      if (right.status === 'ONLINE' && left.status !== 'ONLINE') return 1
      if (left.status === 'UNAVAILABLE' && right.status !== 'UNAVAILABLE') return 1
      if (right.status === 'UNAVAILABLE' && left.status !== 'UNAVAILABLE') return -1
      return left.name.localeCompare(right.name)
    })
  }, [chatContactsQuery.data, connectedUsersQuery.data, user?.id])

  const filteredContacts = useMemo(() => {
    const normalizedSearch = contactSearch.trim().toLowerCase()
    if (!normalizedSearch) return contacts
    return contacts.filter((contact) => contact.searchableText.includes(normalizedSearch))
  }, [contactSearch, contacts])

  const selectedContact =
    contacts.find((contact) => contact.key === selectedContactKey) ??
    contacts.find((contact) => contact.userId === recipientUserId) ??
    null

  const conversationQuery = useQuery({
    enabled: Boolean(user?.id && recipientUserId),
    queryFn: () => communicationApi.getConversation(user!.id, recipientUserId!),
    queryKey: ['conversation', user?.id, recipientUserId],
  })

  useEffect(() => {
    if (selectedContactKey && contacts.some((contact) => contact.key === selectedContactKey)) return
    const matchingRecipient = contacts.find((contact) => contact.userId === recipientUserId)
    if (matchingRecipient) {
      setSelectedContactKey(matchingRecipient.key)
      setRecipientName(matchingRecipient.name)
      return
    }

    if (recipientUserId) {
      setSelectedContactKey(null)
      return
    }

    const firstAvailableContact = contacts.find((contact) => contact.userId)
    if (!firstAvailableContact) return
    setRecipientUserId(firstAvailableContact.userId!)
    setRecipientName(firstAvailableContact.name)
    setSelectedContactKey(firstAvailableContact.key)
    recipientForm.setValue('recipientUserId', firstAvailableContact.userId!)
  }, [contacts, recipientForm, recipientUserId, selectedContactKey])

  const connectMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('Sesion requerida')
      return communicationApi.connect({
        fullName: workspace.doctorProfile?.fullName ?? user.username,
        userId: user.id,
        username: user.username,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['connected-users'] })
    },
  })
  const disconnectMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('Sesion requerida')
      return communicationApi.disconnect({
        fullName: workspace.doctorProfile?.fullName ?? user.username,
        userId: user.id,
        username: user.username,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['connected-users'] })
    },
  })
  const sendMessageMutation = useMutation({
    mutationFn: (values: MessageForm) => {
      if (!recipientUserId) throw new Error('Selecciona un contacto disponible')
      return communicationApi.sendMessage({
        content: values.content,
        recipientUserId,
        sentAt: new Date().toISOString(),
      })
    },
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
    const knownContact = contacts.find((contact) => contact.userId === values.recipientUserId)
    setRecipientUserId(values.recipientUserId)
    setRecipientName(knownContact?.name ?? null)
    setSelectedContactKey(knownContact?.key ?? null)
    setError(null)
  }

  function selectContact(contact: ChatContact) {
    if (!contact.userId) return
    setRecipientUserId(contact.userId)
    setRecipientName(contact.name)
    setSelectedContactKey(contact.key)
    recipientForm.setValue('recipientUserId', contact.userId)
    setError(null)
  }

  return (
    <>
      <PageHeader
        actions={
          <div className="flex gap-2">
            <Button
              disabled={!user}
              isLoading={connectMutation.isPending}
              onClick={() => runAction(() => connectMutation.mutateAsync())}
              variant="secondary"
            >
              <Wifi className="h-4 w-4" aria-hidden="true" />
              Conectar
            </Button>
            <Button
              disabled={!user}
              isLoading={disconnectMutation.isPending}
              onClick={() => runAction(() => disconnectMutation.mutateAsync())}
              variant="ghost"
            >
              <WifiOff className="h-4 w-4" aria-hidden="true" />
              Desconectar
            </Button>
          </div>
        }
        eyebrow="Communication"
        title="Chat"
      />
      <FormError message={error} />

      <div className="grid grid-cols-[380px_1fr] gap-6">
        <Panel>
          <PanelHeader eyebrow="Contactos" title="Personas" />
          <PanelBody className="space-y-4">
            <form className="grid grid-cols-[1fr_auto] items-end gap-3" onSubmit={recipientForm.handleSubmit(selectRecipient)}>
              <TextField
                error={recipientForm.formState.errors.recipientUserId?.message}
                label="ID de usuario"
                type="number"
                {...recipientForm.register('recipientUserId')}
              />
              <Button type="submit" variant="secondary">
                Abrir
              </Button>
            </form>

            <TextField
              label="Buscar"
              onChange={(event) => setContactSearch(event.target.value)}
              placeholder="Nombre, correo o ID"
              value={contactSearch}
            />

            {connectedUsersQuery.isLoading || chatContactsQuery.isLoading ? (
              <LoadingBlock />
            ) : filteredContacts.length ? (
              <div className="space-y-2">
                {filteredContacts.map((contact) => {
                  const selected = selectedContactKey === contact.key || recipientUserId === contact.userId
                  const disabled = !contact.userId
                  return (
                    <button
                      className={[
                        'w-full rounded-lg border p-3 text-left transition',
                        selected
                          ? 'border-teal-700 bg-teal-50'
                          : disabled
                            ? 'border-slate-200 bg-slate-50'
                            : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50',
                      ].join(' ')}
                      disabled={disabled}
                      key={contact.key}
                      onClick={() => selectContact(contact)}
                      type="button"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={[
                            'grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-black',
                            disabled ? 'bg-slate-200 text-slate-500' : 'bg-teal-700 text-white',
                          ].join(' ')}
                        >
                          {getInitials(contact.name) || <UserRound className="h-4 w-4" aria-hidden="true" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-black text-slate-950">{contact.name}</span>
                            <StatusBadge
                              tone={
                                contact.status === 'ONLINE'
                                  ? 'emerald'
                                  : contact.status === 'UNAVAILABLE'
                                    ? 'amber'
                                    : 'slate'
                              }
                            >
                              {contact.status === 'UNAVAILABLE' ? 'Sin chat' : contact.status}
                            </StatusBadge>
                          </span>
                          <span className="mt-1 block truncate text-xs font-semibold text-slate-500">
                            {contact.subtitle}
                          </span>
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <EmptyState title="Sin contactos" />
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow={selectedContact?.subtitle ?? recipientName ?? (recipientUserId ? `Usuario ${recipientUserId}` : 'Conversacion')}
            title={selectedContact?.name ?? 'Mensajes'}
          />
          <PanelBody className="space-y-4">
            {conversationQuery.isLoading ? (
              <LoadingBlock />
            ) : conversationQuery.data?.length ? (
              <div className="max-h-[540px] space-y-3 overflow-y-auto pr-2">
                {conversationQuery.data.map((message) => {
                  const ownMessage = message.senderUserId === user?.id
                  return (
                    <div className={`flex ${ownMessage ? 'justify-end' : 'justify-start'}`} key={message.id}>
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-3 ${
                          ownMessage ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-900'
                        }`}
                      >
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

            <form
              className="grid grid-cols-[1fr_auto] items-end gap-3"
              onSubmit={messageForm.handleSubmit((values) =>
                runAction(() => sendMessageMutation.mutateAsync(values)),
              )}
            >
              <TextareaField error={messageForm.formState.errors.content?.message} label="Mensaje" {...messageForm.register('content')} />
              <Button disabled={!recipientUserId} isLoading={sendMessageMutation.isPending} type="submit">
                <Send className="h-4 w-4" aria-hidden="true" />
                Enviar
              </Button>
            </form>

            {!recipientUserId ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                <MessageSquare className="mr-2 inline h-4 w-4 align-[-2px]" aria-hidden="true" />
                Selecciona un usuario para abrir la conversacion.
              </div>
            ) : null}
          </PanelBody>
        </Panel>
      </div>
    </>
  )
}

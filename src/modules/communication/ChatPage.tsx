import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { MessageSquare, Send, UserRound } from 'lucide-react'
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
import { useAuth } from '@/modules/auth/useAuth'
import { formatDateTime } from '@/shared/utils/format'
import type { ProfileChatContact } from '@/shared/types/api'

const messageSchema = z.object({
  content: z.string().min(1, 'Mensaje requerido'),
})

type MessageForm = z.infer<typeof messageSchema>

type ChatContact = {
  key: string
  name: string
  searchableText: string
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

function careTeamContact(contact: ProfileChatContact): ChatContact {
  const typeLabel = contact.contactType === 'DOCTOR' ? 'Médico' : 'Familiar'
  return {
    key: `care-${contact.userId}-${contact.patientId}`,
    name: contact.fullName,
    searchableText: `${contact.fullName} ${contact.patientFullName} ${typeLabel} ${contact.userId}`.toLowerCase(),
    subtitle: `${typeLabel} de ${contact.patientFullName}`,
    userId: contact.userId,
  }
}

export function ChatPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [recipientUserId, setRecipientUserId] = useState<number | null>(null)
  const [recipientName, setRecipientName] = useState<string | null>(null)
  const [contactSearch, setContactSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedContactKey, setSelectedContactKey] = useState<string | null>(null)
  const messageForm = useForm<MessageForm>({
    resolver: zodResolver(messageSchema),
    defaultValues: { content: '' },
  })

  const chatContactsQuery = useQuery({
    queryFn: profilesApi.listChatContacts,
    queryKey: ['profile-chat-contacts'],
    retry: false,
  })

  const contacts = useMemo<ChatContact[]>(() => {
    return (chatContactsQuery.data ?? [])
      .filter((contact) => contact.userId !== user?.id)
      .map(careTeamContact)
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [chatContactsQuery.data, user?.id])

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
  }, [contacts, recipientUserId, selectedContactKey])

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

  function selectContact(contact: ChatContact) {
    if (!contact.userId) return
    setRecipientUserId(contact.userId)
    setRecipientName(contact.name)
    setSelectedContactKey(contact.key)
    setError(null)
  }

  return (
    <>
      <PageHeader eyebrow="Comunicación" title="Chat" />
      <FormError message={error} />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Panel>
          <PanelHeader eyebrow="Contactos" title="Personas" />
          <PanelBody className="space-y-4">
            <TextField
              label="Buscar"
              onChange={(event) => setContactSearch(event.target.value)}
              placeholder="Nombre o paciente"
              value={contactSearch}
            />

            {chatContactsQuery.isLoading ? (
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
                          ? 'border-blue-600 bg-blue-50'
                          : disabled
                            ? 'border-slate-200 bg-slate-50'
                            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50',
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
                            disabled ? 'bg-slate-200 text-slate-500' : 'bg-blue-600 text-white',
                          ].join(' ')}
                        >
                          {getInitials(contact.name) || <UserRound className="h-4 w-4" aria-hidden="true" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-slate-950">{contact.name}</span>
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
            eyebrow={selectedContact?.subtitle ?? recipientName ?? (recipientUserId ? 'Contacto seleccionado' : 'Conversación')}
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
                          ownMessage ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900'
                        }`}
                      >
                        <p className="text-sm font-semibold">{message.content}</p>
                        <p className={`mt-2 text-xs font-semibold ${ownMessage ? 'text-blue-100' : 'text-slate-500'}`}>
                          {formatDateTime(message.sentAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState title={recipientUserId ? 'Sin mensajes' : 'Sin conversación abierta'} />
            )}

            <form
              className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
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
                Selecciona un contacto del equipo de cuidado para abrir la conversación.
              </div>
            ) : null}
          </PanelBody>
        </Panel>
      </div>
    </>
  )
}

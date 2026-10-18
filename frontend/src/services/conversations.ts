import type { Conversation, DeleteResult, Message } from '../types/api'
import { apiRequest } from './api'

export async function listConversations(): Promise<Conversation[]> {
  const data = await apiRequest<{ conversations: Conversation[] }>('/conversations/')
  return data.conversations
}

export function createConversation(title: string): Promise<Conversation> {
  return apiRequest<Conversation>('/conversations/', { method: 'POST', json: { title } })
}

// Renames the conversation and returns the updated record.
export async function renameConversation(
  conversationId: string,
  title: string,
): Promise<Conversation> {
  const data = await apiRequest<{ message: string; conversation: Conversation }>(
    `/conversations/${encodeURIComponent(conversationId)}`,
    { method: 'PATCH', json: { title } },
  )
  return data.conversation
}

// Pins or unpins the conversation and returns the updated record.
export async function pinConversation(
  conversationId: string,
  isPinned: boolean,
): Promise<Conversation> {
  const data = await apiRequest<{ message: string; conversation: Conversation }>(
    `/conversations/${encodeURIComponent(conversationId)}/pin`,
    { method: 'PATCH', json: { is_pinned: isPinned } },
  )
  return data.conversation
}

// Deletes the conversation; its messages are removed by the database cascade.
export function deleteConversation(conversationId: string): Promise<DeleteResult> {
  return apiRequest<DeleteResult>(`/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
  })
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const data = await apiRequest<{ messages: Message[] }>(
    `/conversations/${encodeURIComponent(conversationId)}/messages/`,
  )
  return data.messages
}

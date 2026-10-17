import type { Conversation, Message } from '../types/api'
import { apiRequest } from './api'

export async function listConversations(): Promise<Conversation[]> {
  const data = await apiRequest<{ conversations: Conversation[] }>('/conversations/')
  return data.conversations
}

export function createConversation(title: string): Promise<Conversation> {
  return apiRequest<Conversation>('/conversations/', { method: 'POST', json: { title } })
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const data = await apiRequest<{ messages: Message[] }>(
    `/conversations/${encodeURIComponent(conversationId)}/messages/`,
  )
  return data.messages
}

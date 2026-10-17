import type { ChatResponse } from '../types/api'
import { apiRequest } from './api'

// Matches ChatRequest.question in backend/app/api/chat.py.
export const MAX_QUESTION_LENGTH = 10000

// Runs the RAG workflow; the backend saves both the question and the answer.
export function askEvida(conversationId: string, question: string): Promise<ChatResponse> {
  return apiRequest<ChatResponse>('/chat/', {
    method: 'POST',
    json: { conversation_id: conversationId, question },
  })
}

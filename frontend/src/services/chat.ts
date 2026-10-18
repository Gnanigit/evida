import type { ChatResponse } from '../types/api'
import { apiRequest } from './api'

// Matches ChatRequest.question in backend/app/api/chat.py.
export const MAX_QUESTION_LENGTH = 10000

// Runs the RAG workflow; the backend saves both the question and the answer.
// attachmentIds: files sent with this question, saved on the user message.
export function askEvida(
  conversationId: string,
  question: string,
  attachmentIds: string[] = [],
): Promise<ChatResponse> {
  return apiRequest<ChatResponse>('/chat/', {
    method: 'POST',
    json: { conversation_id: conversationId, question, attachment_ids: attachmentIds },
  })
}

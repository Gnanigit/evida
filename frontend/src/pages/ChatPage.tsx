import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import Composer from '../components/chat/Composer'
import MessageItem from '../components/chat/MessageItem'
import type { ChatItem } from '../components/chat/types'
import { useAppContext } from '../components/layout/appContext'
import { errorMessage } from '../services/api'
import { askEvida } from '../services/chat'
import { createConversation, listMessages } from '../services/conversations'

type SendFailure = { question: string; message: string }

// Passed through navigation when the first question creates a conversation.
type Handoff = { conversationId: string; messages?: ChatItem[]; failure?: SendFailure }

const MAX_TITLE_LENGTH = 80

function titleFrom(question: string): string {
  const title = question.replace(/\s+/g, ' ').trim()
  return title.length > MAX_TITLE_LENGTH ? `${title.slice(0, MAX_TITLE_LENGTH - 1)}…` : title
}

export default function ChatPage({ conversationId }: { conversationId?: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshConversations } = useAppContext()

  const [handoff] = useState<Handoff | null>(() => {
    const state = (location.state as { handoff?: Handoff } | null)?.handoff
    return state && state.conversationId === conversationId ? state : null
  })

  const [messages, setMessages] = useState<ChatItem[]>(() => handoff?.messages ?? [])
  const [loading, setLoading] = useState(Boolean(conversationId) && !handoff?.messages)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)
  const [failure, setFailure] = useState<SendFailure | null>(handoff?.failure ?? null)
  const [draft, setDraft] = useState('')

  const mountedRef = useRef(true)
  const sendingRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Drop the one-time handoff so a browser refresh reloads from the server.
  useEffect(() => {
    if (location.state) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state, location.pathname, navigate])

  useEffect(() => {
    if (!conversationId) return
    if (reloadCount === 0 && handoff?.messages) return

    let ignore = false

    listMessages(conversationId)
      .then((loaded) => {
        if (ignore) return
        setMessages(loaded)
        setLoadError(null)
      })
      .catch((error: unknown) => {
        if (!ignore) setLoadError(errorMessage(error))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [conversationId, reloadCount, handoff])

  // Follow new content only while the user is already at the bottom.
  useEffect(() => {
    const element = scrollRef.current
    if (element && stickToBottomRef.current) {
      element.scrollTop = element.scrollHeight
    }
  }, [messages, pendingQuestion, failure])

  function handleScroll() {
    const element = scrollRef.current
    if (!element) return
    stickToBottomRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 80
  }

  async function sendQuestion(question: string) {
    if (sendingRef.current) return
    sendingRef.current = true
    stickToBottomRef.current = true
    setPendingQuestion(question)
    setFailure(null)

    let targetId = conversationId

    try {
      if (!targetId) {
        const conversation = await createConversation(titleFrom(question))
        targetId = conversation.id
        void refreshConversations()
      }

      const response = await askEvida(targetId, question)
      const [userMessage, assistantMessage] = response.messages
      const newItems: ChatItem[] = [
        userMessage,
        { ...assistantMessage, sources: response.sources },
      ]
      void refreshConversations()

      if (!mountedRef.current) return

      if (!conversationId) {
        navigate(`/c/${targetId}`, { state: { handoff: { conversationId: targetId, messages: newItems } } })
        return
      }

      setMessages((previous) => [...previous, ...newItems])
    } catch (error) {
      const sendFailure = { question, message: errorMessage(error) }

      if (!mountedRef.current) return

      if (!conversationId && targetId) {
        // The conversation exists now; show it with the failure.
        navigate(`/c/${targetId}`, {
          state: { handoff: { conversationId: targetId, failure: sendFailure } },
        })
        return
      }

      setFailure(sendFailure)

      if (conversationId) {
        // The backend may have saved the question before failing; show what it stored.
        setReloadCount((count) => count + 1)
      } else {
        // Nothing was saved; give the question back to the user.
        setDraft(question)
      }
    } finally {
      sendingRef.current = false
      if (mountedRef.current) setPendingQuestion(null)
    }
  }

  function handleSubmit() {
    const question = draft.trim()
    if (!question) return
    setDraft('')
    void sendQuestion(question)
  }

  function retryLoad() {
    setLoading(true)
    setLoadError(null)
    setReloadCount((count) => count + 1)
  }

  const sending = pendingQuestion !== null
  const isEmpty = messages.length === 0 && !sending && !loading && !loadError

  return (
    <div className="chat">
      <div className="chat-scroll" ref={scrollRef} onScroll={handleScroll}>
        <div className="chat-thread">
          {loading && <p className="muted center">Loading conversation…</p>}

          {loadError && (
            <div className="alert alert-error" role="alert">
              <p>{loadError}</p>
              <button type="button" className="button button-small" onClick={retryLoad}>
                Retry
              </button>
            </div>
          )}

          {isEmpty && !conversationId && (
            <div className="empty-state">
              <h1>Ask Evida</h1>
              <p className="muted">
                Ask a research question. Evida answers from general knowledge, your uploaded
                PDFs, and the web, and cites the evidence it used.
              </p>
            </div>
          )}

          {isEmpty && conversationId && (
            <p className="muted center">No messages in this conversation yet.</p>
          )}

          {messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}

          {pendingQuestion !== null && (
            <>
              <div className="message message-user">
                <p className="message-text">{pendingQuestion}</p>
              </div>
              <div className="message message-assistant" aria-live="polite">
                <div className="message-role">Evida</div>
                <p className="muted thinking">
                  Researching<span className="dots" aria-hidden="true" />
                </p>
              </div>
            </>
          )}

          {failure && (
            <div className="alert alert-error" role="alert">
              <p>
                <strong>Evida could not answer.</strong> {failure.message}
              </p>
              <button
                type="button"
                className="button button-small"
                onClick={() => void sendQuestion(failure.question)}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="chat-composer">
        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          disabled={sending || Boolean(loadError) || loading}
        />
      </div>
    </div>
  )
}

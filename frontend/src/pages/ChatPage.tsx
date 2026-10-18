import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ArrowDown, CircleAlert, FileText, Globe, Layers } from 'lucide-react'
import AssistantLabel from '../components/chat/AssistantLabel'
import AttachmentChips from '../components/chat/AttachmentChips'
import MessageAttachments from '../components/chat/MessageAttachments'
import Composer from '../components/chat/Composer'
import MessageItem from '../components/chat/MessageItem'
import ThinkingIndicator from '../components/chat/ThinkingIndicator'
import { useAttachments } from '../components/chat/useAttachments'
import Wordmark from '../components/common/Wordmark'
import type { ChatItem } from '../components/chat/types'
import { useAppContext } from '../components/layout/appContext'
import { errorMessage } from '../services/api'
import { askEvida } from '../services/chat'
import type { MessageAttachment } from '../types/api'
import { createConversation, listMessages, renameConversation } from '../services/conversations'

type SendFailure = { question: string; message: string; attachments: MessageAttachment[] }

// Passed through navigation when the first question creates a conversation.
type Handoff = { conversationId: string; messages?: ChatItem[]; failure?: SendFailure }

const MAX_TITLE_LENGTH = 80

// Starter prompts on the new-chat screen; clicking one fills the composer.
const SUGGESTIONS = [
  {
    label: 'Summarize a document',
    prompt: 'Summarize the key findings of my most recent PDF.',
    Icon: FileText,
  },
  {
    label: 'Compare my sources',
    prompt: 'Compare the main arguments across my uploaded documents.',
    Icon: Layers,
  },
  {
    label: 'Latest research',
    prompt: 'What does recent research say about ',
    Icon: Globe,
  },
]

// Distance from the bottom (px) within which the thread counts as "at the latest message".
const NEAR_BOTTOM = 80

function titleFrom(question: string): string {
  const title = question.replace(/\s+/g, ' ').trim()
  return title.length > MAX_TITLE_LENGTH ? `${title.slice(0, MAX_TITLE_LENGTH - 1)}…` : title
}

export default function ChatPage({ conversationId }: { conversationId?: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { conversations, refreshConversations } = useAppContext()

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
  const [showJump, setShowJump] = useState(false)
  // Files shown on the question while its answer is pending.
  const [pendingFiles, setPendingFiles] = useState<MessageAttachment[]>([])

  const mountedRef = useRef(true)
  const sendingRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // On a new chat, attaching creates the conversation (uploads need its ID).
  // It stays on this page until the first answer, so uploads are not interrupted.
  const createdIdRef = useRef<string | null>(null)
  const creatingRef = useRef<Promise<string> | null>(null)
  // The attach-created conversation is titled after the file until the first question.
  const titledFromQuestionRef = useRef(false)

  const [dragging, setDragging] = useState(false)
  const dragDepthRef = useRef(0)

  function ensureConversation(fileName: string): Promise<string> {
    if (conversationId) return Promise.resolve(conversationId)
    if (createdIdRef.current) return Promise.resolve(createdIdRef.current)
    if (!creatingRef.current) {
      const title = titleFrom(fileName.replace(/\.pdf$/i, '')) || 'New conversation'
      creatingRef.current = createConversation(title)
        .then((conversation) => {
          createdIdRef.current = conversation.id
          void refreshConversations()
          return conversation.id
        })
        .catch((error: unknown) => {
          creatingRef.current = null
          throw error
        })
    }
    return creatingRef.current
  }

  const {
    pending: pendingAttachments,
    attach,
    retry: retryAttachment,
    remove: removeAttachment,
    markSent: markAttachmentsSent,
    processing: attachmentsProcessing,
    hasReady: hasReadyAttachments,
  } = useAttachments(conversationId, ensureConversation)
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
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM
    stickToBottomRef.current = nearBottom
    setShowJump(!nearBottom)
  }

  function scrollToBottom() {
    const element = scrollRef.current
    if (!element) return
    stickToBottomRef.current = true
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
  }

  async function sendQuestion(question: string, files: MessageAttachment[] = []) {
    if (sendingRef.current) return
    sendingRef.current = true
    stickToBottomRef.current = true
    setPendingQuestion(question)
    setPendingFiles(files)
    setFailure(null)

    let targetId = conversationId ?? createdIdRef.current ?? undefined

    try {
      if (!targetId) {
        const conversation = await createConversation(titleFrom(question))
        targetId = conversation.id
        void refreshConversations()
      } else if (!conversationId && !titledFromQuestionRef.current) {
        // Created by attaching a file: title it after the first question instead.
        titledFromQuestionRef.current = true
        void renameConversation(targetId, titleFrom(question))
          .then(() => refreshConversations())
          .catch(() => {
            // Keeps the file-name title; the user can rename it.
          })
      }

      const response = await askEvida(
        targetId,
        question,
        files.map((file) => file.id),
      )
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
      const sendFailure = { question, message: errorMessage(error), attachments: files }

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
    // Ready files go with this question (shown on the message) and leave the composer.
    const files = pendingAttachments.flatMap((item) =>
      item.status === 'ready' && item.documentId
        ? [{ id: item.documentId, filename: item.name }]
        : [],
    )
    markAttachmentsSent()
    void sendQuestion(question, files)
  }

  function retryLoad() {
    setLoading(true)
    setLoadError(null)
    setReloadCount((count) => count + 1)
  }

  const sending = pendingQuestion !== null
  const isEmpty = messages.length === 0 && !sending && !loading && !loadError
  // New chat with nothing asked yet: centre the composer under the heading.
  const startMode = !conversationId && messages.length === 0 && !sending && !failure
  const title = conversations.find((conversation) => conversation.id === conversationId)?.title

  function applySuggestion(prompt: string) {
    setDraft(prompt)
    // Focus after React applies the new value, with the caret at the end.
    window.requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    })
  }

  const composerHint = attachmentsProcessing
    ? 'Waiting for files to finish processing…'
    : hasReadyAttachments
      ? 'Answers in this chat use only the attached files.'
      : undefined

  const composer = (
    <Composer
      value={draft}
      onChange={setDraft}
      onSubmit={handleSubmit}
      disabled={sending || Boolean(loadError) || loading || attachmentsProcessing}
      busy={sending}
      placeholder={
        hasReadyAttachments
          ? 'Ask about the attached files…'
          : startMode
            ? 'Ask a research question…'
            : 'Ask a follow-up…'
      }
      inputRef={inputRef}
      onAttach={attach}
      attachments={
        <AttachmentChips
          attachments={pendingAttachments}
          onRetry={retryAttachment}
          onRemove={(key) => void removeAttachment(key)}
        />
      }
      hint={composerHint}
    />
  )

  // Drop PDFs anywhere on the chat to attach them.
  const dropHandlers = {
    onDragEnter: (event: DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes('Files')) return
      event.preventDefault()
      dragDepthRef.current += 1
      setDragging(true)
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (event.dataTransfer.types.includes('Files')) event.preventDefault()
    },
    onDragLeave: () => {
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) setDragging(false)
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes('Files')) return
      event.preventDefault()
      dragDepthRef.current = 0
      setDragging(false)
      attach(Array.from(event.dataTransfer.files))
    },
  }

  const dropOverlay = dragging && (
    <div className="chat-drop-overlay" aria-hidden="true">
      Drop PDFs to attach
    </div>
  )

  if (startMode) {
    return (
      <div className="chat chat-start" {...dropHandlers}>
        {dropOverlay}
        <div className="chat-hero">
          <h1 className="hero-title">
            Ask <Wordmark />
          </h1>
          <p className="chat-hero-subtitle">
            Research answers from general knowledge, your PDFs, and the web — with the evidence
            cited.
          </p>
          {composer}
          <div className="suggestions" aria-label="Suggestions">
            {SUGGESTIONS.map(({ label, prompt, Icon }) => (
              <button
                key={label}
                type="button"
                className="suggestion"
                onClick={() => applySuggestion(prompt)}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat" {...dropHandlers}>
      {dropOverlay}
      {conversationId && (
        <header className="chat-header">
          <h1 className="chat-title" title={title}>
            {title ?? 'Conversation'}
          </h1>
        </header>
      )}

      <div className="chat-scroll" ref={scrollRef} onScroll={handleScroll}>
        <div className="chat-thread">
          {loading && (
            <div className="chat-skeleton" aria-busy="true" aria-label="Loading conversation">
              <span className="skeleton-bar skeleton-user" />
              <span className="skeleton-bar skeleton-line" />
              <span className="skeleton-bar skeleton-line" />
              <span className="skeleton-bar skeleton-line skeleton-short" />
            </div>
          )}

          {loadError && (
            <div className="alert alert-error" role="alert">
              <p>{loadError}</p>
              <button type="button" className="button button-small" onClick={retryLoad}>
                Retry
              </button>
            </div>
          )}

          {isEmpty && <p className="chat-note">No messages in this conversation yet.</p>}

          {messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}

          {pendingQuestion !== null && (
            <>
              <div className="turn turn-user">
                <MessageAttachments files={pendingFiles} />
                <div className="user-bubble">{pendingQuestion}</div>
              </div>
              <ThinkingIndicator />
            </>
          )}

          {failure && (
            <div className="turn turn-assistant">
              <AssistantLabel />
              <div className="error-card" role="alert">
                <CircleAlert size={18} className="error-card-icon" aria-hidden="true" />
                <div className="error-card-body">
                  <p className="error-card-title">Evida couldn&apos;t answer</p>
                  <p className="error-card-message">{failure.message}</p>
                </div>
                <button
                  type="button"
                  className="button button-small"
                  onClick={() => void sendQuestion(failure.question, failure.attachments)}
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="chat-bottom">
        {showJump && (
          <button
            type="button"
            className="jump-button"
            aria-label="Scroll to the latest message"
            title="Scroll to the latest message"
            onClick={scrollToBottom}
          >
            <ArrowDown size={18} aria-hidden="true" />
          </button>
        )}
        {composer}
      </div>
    </div>
  )
}

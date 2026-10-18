import { useEffect, useRef, useState } from 'react'
import { errorMessage } from '../../services/api'
import {
  deleteDocument,
  indexDocument,
  listDocuments,
  uploadDocument,
  validatePdfFile,
} from '../../services/documents'

export type AttachmentStatus = 'invalid' | 'waiting' | 'uploading' | 'indexing' | 'ready' | 'error'

export type Attachment = {
  key: string
  name: string
  // Unknown for attachments loaded from the server.
  size: number | null
  status: AttachmentStatus
  error?: string
  // Set once uploaded, so a retry only needs to re-run indexing.
  documentId?: string
  file?: File
  // True once a question was sent with it (or it was loaded with the chat).
  // Sent files leave the composer and can no longer be removed from the chat.
  sent: boolean
}

const BUSY: AttachmentStatus[] = ['waiting', 'uploading', 'indexing']

let nextKey = 0

// Files attached in a chat: each is uploaded to the conversation, then indexed,
// one at a time (the backend takes one file per request), like ChatGPT/Claude
// processing attachments before the question is sent.
export function useAttachments(
  conversationId: string | undefined,
  // Returns the conversation to attach to, creating it first on a new chat.
  ensureConversation: (fileName: string) => Promise<string>,
) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const chainRef = useRef<Promise<void>>(Promise.resolve())

  // Show the files already attached to this conversation.
  useEffect(() => {
    if (!conversationId) return
    let ignore = false

    listDocuments({ conversationId })
      .then((documents) => {
        if (ignore) return
        setAttachments((previous) => {
          const known = new Set(previous.map((item) => item.documentId))
          const loaded: Attachment[] = documents
            .filter((document) => !known.has(document.id))
            .map((document) => ({
              key: `doc-${document.id}`,
              name: document.filename,
              size: null,
              status: document.indexed_at ? 'ready' : 'error',
              error: document.indexed_at ? undefined : 'Not processed yet.',
              documentId: document.id,
              sent: true,
            }))
          return [...loaded, ...previous]
        })
      })
      .catch(() => {
        // Not fatal: the chat still works; the chips just are not listed.
      })

    return () => {
      ignore = true
    }
  }, [conversationId])

  function update(key: string, patch: Partial<Attachment>) {
    setAttachments((previous) =>
      previous.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    )
  }

  // Upload (unless already uploaded), then index. Never throws.
  async function process(key: string, file: File | undefined, existingDocumentId?: string) {
    try {
      let documentId = existingDocumentId

      if (!documentId) {
        if (!file) return
        update(key, { status: 'uploading', error: undefined })
        const targetConversationId = await ensureConversation(file.name)
        const uploaded = await uploadDocument(file, targetConversationId)
        documentId = uploaded.id
        update(key, { documentId })
      }

      update(key, { status: 'indexing', error: undefined })
      await indexDocument(documentId)
      update(key, { status: 'ready' })
    } catch (error) {
      update(key, { status: 'error', error: errorMessage(error) })
    }
  }

  function schedule(key: string, file: File | undefined, documentId?: string) {
    chainRef.current = chainRef.current.then(() => process(key, file, documentId))
  }

  function attach(files: File[]) {
    const items: Attachment[] = files.map((file) => {
      const error = validatePdfFile(file)
      nextKey += 1
      return {
        key: `attachment-${nextKey}`,
        name: file.name,
        size: file.size,
        status: error ? 'invalid' : 'waiting',
        error: error ?? undefined,
        file,
        sent: false,
      }
    })

    setAttachments((previous) => [...previous, ...items])
    for (const item of items) {
      if (item.status === 'waiting') schedule(item.key, item.file)
    }
  }

  function retry(key: string) {
    const item = attachments.find((entry) => entry.key === key)
    if (!item || item.status !== 'error') return
    update(key, { status: 'waiting', error: undefined })
    schedule(key, item.file, item.documentId)
  }

  // A question was sent: ready files now belong to the conversation.
  function markSent() {
    setAttachments((previous) =>
      previous.map((item) => (item.status === 'ready' ? { ...item, sent: true } : item)),
    )
  }

  // Removing an unsent attachment deletes it (file and search index).
  async function remove(key: string) {
    const item = attachments.find((entry) => entry.key === key)
    if (!item || item.sent || BUSY.includes(item.status)) return

    setAttachments((previous) => previous.filter((entry) => entry.key !== key))
    if (!item.documentId) return

    try {
      await deleteDocument(item.documentId)
    } catch (error) {
      // Put it back so the user knows it is still attached.
      setAttachments((previous) => [
        ...previous,
        { ...item, status: 'error', error: `Couldn't remove: ${errorMessage(error)}` },
      ])
    }
  }

  const processing = attachments.some((item) => BUSY.includes(item.status))
  const hasReady = attachments.some((item) => item.status === 'ready')

  // Composer chips: files not yet sent (sent ones show on their message instead).
  const pending = attachments.filter((item) => !item.sent)

  return { pending, attach, retry, remove, markSent, processing, hasReady }
}

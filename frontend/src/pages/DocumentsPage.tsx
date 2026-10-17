import { useCallback, useEffect, useRef, useState, type ChangeEvent, type SubmitEvent } from 'react'
import { errorMessage } from '../services/api'
import {
  deleteDocument,
  formatFileSize,
  indexDocument,
  listDocuments,
  uploadDocument,
  validatePdfFile,
} from '../services/documents'
import type { DocumentRecord } from '../types/api'

// Indexing requests made during this visit; overrides the stored indexed_at.
type IndexStatus =
  | { state: 'indexing' }
  | { state: 'indexed'; chunks: number }
  | { state: 'error'; message: string }

type Notice = { kind: 'success' | 'error'; text: string }

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadNotice, setUploadNotice] = useState<Notice | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [indexStatus, setIndexStatus] = useState<Record<string, IndexStatus>>({})
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)

  const refreshDocuments = useCallback(
    () =>
      listDocuments()
        .then((items) => {
          setDocuments(items)
          setListError(null)
        })
        .catch((error: unknown) => setListError(errorMessage(error)))
        .finally(() => setLoading(false)),
    [],
  )

  useEffect(() => {
    void refreshDocuments()
  }, [refreshDocuments])

  function setStatus(documentId: string, status: IndexStatus | null) {
    setIndexStatus((previous) => {
      const next = { ...previous }
      if (status) next[documentId] = status
      else delete next[documentId]
      return next
    })
  }

  async function runIndex(documentId: string) {
    setStatus(documentId, { state: 'indexing' })
    try {
      const result = await indexDocument(documentId)
      setStatus(documentId, { state: 'indexed', chunks: result.chunks_indexed })
      void refreshDocuments()
    } catch (error) {
      setStatus(documentId, { state: 'error', message: errorMessage(error) })
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
    setFileError(file ? validatePdfFile(file) : null)
    setUploadNotice(null)
  }

  async function handleUpload(event: SubmitEvent) {
    event.preventDefault()
    if (!selectedFile || fileError || uploading) return

    setUploading(true)
    setUploadNotice(null)

    let uploaded: DocumentRecord
    try {
      uploaded = await uploadDocument(selectedFile)
    } catch (error) {
      setUploadNotice({ kind: 'error', text: errorMessage(error) })
      setUploading(false)
      return
    }

    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploadNotice({ kind: 'success', text: `Uploaded ${uploaded.filename}. Indexing it now…` })
    setUploading(false)
    await refreshDocuments()

    // Uploading only stores the file; indexing makes it searchable.
    await runIndex(uploaded.id)
  }

  async function handleDelete(document: DocumentRecord) {
    setDeletingId(document.id)
    setDeleteError(null)
    try {
      await deleteDocument(document.id)
      setConfirmingDeleteId(null)
      setStatus(document.id, null)
      await refreshDocuments()
    } catch (error) {
      setDeleteError({ id: document.id, message: errorMessage(error) })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="page">
      <h1>Documents</h1>
      <p className="muted">
        Upload PDFs (up to 10 MB). Each upload is indexed so Evida can search it when answering
        your questions. Use <em>Index</em> to process a document again.
      </p>

      <form className="upload-form" onSubmit={handleUpload}>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          aria-label="Choose a PDF"
          onChange={handleFileChange}
          disabled={uploading}
        />
        {selectedFile && (
          <p className="small">
            {selectedFile.name} · {formatFileSize(selectedFile.size)}
          </p>
        )}
        {fileError && (
          <p className="alert alert-error small" role="alert">
            {fileError}
          </p>
        )}
        <button
          type="submit"
          className="button button-primary"
          disabled={!selectedFile || Boolean(fileError) || uploading}
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        {uploadNotice && (
          <p
            className={`alert small${uploadNotice.kind === 'error' ? ' alert-error' : ''}`}
            role={uploadNotice.kind === 'error' ? 'alert' : 'status'}
          >
            {uploadNotice.text}
          </p>
        )}
      </form>

      <h2 className="section-heading">Your documents</h2>

      {listError && (
        <div className="alert alert-error" role="alert">
          <p>{listError}</p>
          <button
            type="button"
            className="button button-small"
            onClick={() => void refreshDocuments()}
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading documents…</p>
      ) : documents.length === 0 && !listError ? (
        <p className="muted">No documents yet. Upload a PDF to get started.</p>
      ) : (
        <ul className="document-list">
          {documents.map((document) => {
            const status = indexStatus[document.id]
            const indexing = status?.state === 'indexing'
            const deleting = deletingId === document.id
            const confirming = confirmingDeleteId === document.id
            const indexed = Boolean(document.indexed_at) || status?.state === 'indexed'

            return (
              <li key={document.id} className="document-row">
                <div className="document-info">
                  <span className="document-name">{document.filename}</span>
                  <span className="muted small">
                    Uploaded {new Date(document.created_at).toLocaleString()}
                  </span>
                  {status?.state === 'indexing' && (
                    <span className="small">Indexing… this can take a minute.</span>
                  )}
                  {status?.state === 'indexed' && (
                    <span className="small status-ok">
                      Indexed · {status.chunks} {status.chunks === 1 ? 'chunk' : 'chunks'}
                    </span>
                  )}
                  {status?.state === 'error' && (
                    <span className="small status-error" role="alert">
                      Indexing failed: {status.message}
                    </span>
                  )}
                  {!status && document.indexed_at && (
                    <span className="small status-ok">
                      Indexed {new Date(document.indexed_at).toLocaleString()}
                    </span>
                  )}
                  {!status && !document.indexed_at && (
                    <span className="small muted">Not indexed</span>
                  )}
                  {deleteError?.id === document.id && (
                    <span className="small status-error" role="alert">
                      {deleteError.message}
                    </span>
                  )}
                </div>

                <div className="document-actions">
                  {confirming ? (
                    <>
                      <span className="small">Delete this PDF and its indexed content?</span>
                      <button
                        type="button"
                        className="button button-small button-danger"
                        onClick={() => void handleDelete(document)}
                        disabled={deleting}
                      >
                        {deleting ? 'Deleting…' : 'Delete'}
                      </button>
                      <button
                        type="button"
                        className="button button-small"
                        onClick={() => setConfirmingDeleteId(null)}
                        disabled={deleting}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="button button-small"
                        onClick={() => void runIndex(document.id)}
                        disabled={indexing}
                      >
                        {indexing ? 'Indexing…' : indexed ? 'Re-index' : 'Index'}
                      </button>
                      <button
                        type="button"
                        className="button button-small"
                        onClick={() => {
                          setDeleteError(null)
                          setConfirmingDeleteId(document.id)
                        }}
                        disabled={indexing}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

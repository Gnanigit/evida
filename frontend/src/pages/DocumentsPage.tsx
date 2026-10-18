import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useEffectEvent,
} from "react";
import { Search, Upload } from "lucide-react";
import ConfirmDialog from "../components/common/ConfirmDialog";
import DocumentPanel from "../components/documents/DocumentPanel";
import DocumentRow from "../components/documents/DocumentRow";
import UploadDialog from "../components/documents/UploadDialog";
import UploadDropzone from "../components/documents/UploadDropzone";
import UploadQueue from "../components/documents/UploadQueue";
import type { DocumentStatus, QueueItem } from "../components/documents/types";
import { errorMessage } from "../services/api";
import {
  deleteDocument,
  indexDocument,
  listDocuments,
  uploadDocument,
  validatePdfFile,
} from "../services/documents";
import type { DocumentRecord } from "../types/api";

// Indexing requests made during this visit; these override the stored indexed_at.
type IndexState =
  | { state: "indexing" }
  | { state: "indexed" }
  | { state: "error"; message: string };

// One filter: where a document lives (library or a chat), or whether it
// still needs indexing.
type Filter = "all" | "library" | "chats" | "not-indexed";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "library", label: "Uploads" },
  { value: "chats", label: "In chats" },
  { value: "not-indexed", label: "Not indexed" },
];

function isAttachment(document: DocumentRecord): boolean {
  return Boolean(document.conversation_id);
}

// Finished uploads leave the queue on their own after this long.
const DONE_DISMISS_MS = 4000;

let nextQueueId = 0;

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [indexState, setIndexState] = useState<Record<string, IndexState>>({});

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  // Document shown in the preview panel (looked up live, so its status stays current).
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null);

  // Uploads run one at a time: the backend accepts a single file per request.
  const uploadChainRef = useRef<Promise<void>>(Promise.resolve());
  // Documents already being (or tried to be) indexed this visit, so each is indexed once.
  const indexAttemptedRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<number[]>([]);

  const refreshDocuments = useCallback(
    () =>
      listDocuments({ includeAttachments: true })
        .then((items) => {
          setDocuments(items);
          setListError(null);
        })
        .catch((error: unknown) => setListError(errorMessage(error)))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  function setDocumentIndex(documentId: string, state: IndexState | null) {
    setIndexState((previous) => {
      const next = { ...previous };
      if (state) next[documentId] = state;
      else delete next[documentId];
      return next;
    });
  }

  function updateQueueItem(id: string, patch: Partial<QueueItem>) {
    setQueue((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function dismissQueueItem(id: string) {
    setQueue((previous) => previous.filter((item) => item.id !== id));
  }

  // Returns the error message, or null on success.
  async function runIndex(documentId: string): Promise<string | null> {
    setDocumentIndex(documentId, { state: "indexing" });
    try {
      await indexDocument(documentId);
      setDocumentIndex(documentId, { state: "indexed" });
      void refreshDocuments();
      return null;
    } catch (error) {
      const message = errorMessage(error);
      setDocumentIndex(documentId, { state: "error", message });
      return message;
    }
  }

  // Upload (unless already uploaded), then index. Never throws.
  async function processUpload(
    id: string,
    file: File,
    existingDocumentId?: string
  ) {
    let documentId = existingDocumentId;

    if (!documentId) {
      updateQueueItem(id, { status: "uploading", error: undefined });
      try {
        const uploaded = await uploadDocument(file);
        documentId = uploaded.id;
        indexAttemptedRef.current.add(documentId);
        void refreshDocuments();
      } catch (error) {
        updateQueueItem(id, { status: "error", error: errorMessage(error) });
        return;
      }
    }

    // Uploading only stores the file; indexing makes it searchable.
    updateQueueItem(id, { status: "indexing", documentId, error: undefined });
    const indexError = await runIndex(documentId);
    if (indexError) {
      updateQueueItem(id, {
        status: "error",
        error: `Uploaded, but indexing failed: ${indexError}`,
      });
      return;
    }

    updateQueueItem(id, { status: "done" });
    timersRef.current.push(
      window.setTimeout(() => dismissQueueItem(id), DONE_DISMISS_MS)
    );
  }

  // Indexing is automatic: index any listed document that isn't indexed yet
  // (e.g. uploaded before auto-indexing), one at a time, once per visit.
  const indexMissing = useEffectEvent((items: DocumentRecord[]) => {
    for (const document of items) {
      if (document.indexed_at || indexState[document.id]) continue;
      if (indexAttemptedRef.current.has(document.id)) continue;
      indexAttemptedRef.current.add(document.id);
      uploadChainRef.current = uploadChainRef.current.then(async () => {
        await runIndex(document.id);
      });
    }
  });

  useEffect(() => {
    indexMissing(documents);
  }, [documents]);

  function scheduleUpload(id: string, file: File, documentId?: string) {
    uploadChainRef.current = uploadChainRef.current.then(() =>
      processUpload(id, file, documentId)
    );
  }

  function handleFiles(files: File[]) {
    const items: QueueItem[] = files.map((file) => {
      const error = validatePdfFile(file);
      nextQueueId += 1;
      return {
        id: `upload-${nextQueueId}`,
        file,
        status: error ? "invalid" : "waiting",
        error: error ?? undefined,
      };
    });

    setQueue((previous) => [...previous, ...items]);
    for (const item of items) {
      if (item.status === "waiting") scheduleUpload(item.id, item.file);
    }
  }

  function retryQueueItem(id: string) {
    const item = queue.find((entry) => entry.id === id);
    if (!item || item.status !== "error") return;
    updateQueueItem(id, { status: "waiting", error: undefined });
    scheduleUpload(id, item.file, item.documentId);
  }

  const statusOf = useCallback(
    (document: DocumentRecord): DocumentStatus => {
      const state = indexState[document.id];
      if (state?.state === "indexing") return "indexing";
      if (state?.state === "error") return "failed";
      if (state?.state === "indexed" || document.indexed_at) return "indexed";
      return "not-indexed";
    },
    [indexState]
  );

  const indexedCount = useMemo(
    () =>
      documents.filter((document) => statusOf(document) === "indexed").length,
    [documents, statusOf]
  );

  const attachmentCount = documents.filter(isAttachment).length;

  const counts: Record<Filter, number> = {
    all: documents.length,
    library: documents.length - attachmentCount,
    chats: attachmentCount,
    "not-indexed": documents.length - indexedCount,
  };

  const visibleDocuments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents.filter((document) => {
      if (needle && !document.filename.toLowerCase().includes(needle))
        return false;
      if (filter === "library") return !isAttachment(document);
      if (filter === "chats") return isAttachment(document);
      if (filter === "not-indexed") return statusOf(document) !== "indexed";
      return true;
    });
  }, [documents, query, filter, statusOf]);

  // Closes on its own if the document is deleted while open.
  const openDocument =
    documents.find((document) => document.id === openDocumentId) ?? null;
  const openDocumentState = openDocument
    ? indexState[openDocument.id]
    : undefined;

  function clearFilters() {
    setQuery("");
    setFilter("all");
  }

  async function confirmDelete(document: DocumentRecord) {
    await deleteDocument(document.id);
    setDocumentIndex(document.id, null);
    await refreshDocuments();
  }

  const showFilesHeading = loading || documents.length > 0

  return (
    <div className="docs-page">
      <header className="docs-header">
        <div>
          <h1 className="docs-title">Library</h1>
          <p className="docs-subtitle">
            Your private research library. Evida searches indexed PDFs when
            answering your questions.
          </p>
        </div>
        <button
          type="button"
          className="button button-primary docs-upload-button"
          onClick={() => setUploadOpen(true)}
        >
          <Upload size={16} aria-hidden="true" />
          Upload PDFs
        </button>
      </header>

      {/* Uploads keep running if the dialog is closed; show their progress here then. */}
      {!uploadOpen && (
        <UploadQueue
          items={queue}
          onRetry={retryQueueItem}
          onDismiss={dismissQueueItem}
        />
      )}

      {uploadOpen && (
        <UploadDialog onClose={() => setUploadOpen(false)}>
          <UploadDropzone onFiles={handleFiles} />
          <UploadQueue
            items={queue}
            onRetry={retryQueueItem}
            onDismiss={dismissQueueItem}
          />
        </UploadDialog>
      )}

      <section
        className="docs-library"
        aria-labelledby={showFilesHeading ? 'docs-library-title' : undefined}
        aria-label={showFilesHeading ? undefined : 'Your files'}
      >
        {/* Hidden for an empty library, where the empty state says it all. */}
        {showFilesHeading && (
          <h2 id="docs-library-title" className="docs-section-title">
            Your files
          </h2>
        )}

        {documents.length > 0 && (
          <div className="docs-toolbar">
            <label className="search-field">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                placeholder="Search documents"
                aria-label="Search documents"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <div
              className="segmented"
              role="group"
              aria-label="Filter documents"
            >
              {FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`segment${filter === value ? " active" : ""}`}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                  <span className="segment-count">{counts[value]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

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
          <ul
            className="doc-list"
            aria-busy="true"
            aria-label="Loading documents"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <li key={index} className="doc-row doc-row-skeleton">
                <span className="doc-tile skeleton-bar" />
                <span className="doc-main">
                  <span className="skeleton-bar" />
                  <span className="skeleton-bar" />
                </span>
              </li>
            ))}
          </ul>
        ) : documents.length === 0 ? (
          !listError && (
            <div className="docs-empty">
              {/* Decorative: the text below says what the state means. */}
              <img
                className="empty-illustration"
                src="/illustrations/folder.svg"
                alt=""
                width={777}
                height={408}
              />
              <h3>Build your research library</h3>
              <p>
                Upload papers, reports, or notes as PDFs. Evida cites the
                document and page it used in every answer.
              </p>
            </div>
          )
        ) : visibleDocuments.length === 0 ? (
          <div className="docs-no-match">
            <img
              className="empty-illustration empty-illustration-small"
              src="/illustrations/searching.svg"
              alt=""
              width={880}
              height={737}
            />
            <p>
              No documents match
              {query.trim() ? ` "${query.trim()}"` : " this filter"}.{" "}
              <button
                type="button"
                className="text-button"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </p>
          </div>
        ) : (
          <ul className="doc-list">
            {visibleDocuments.map((document) => {
              const state = indexState[document.id];
              return (
                <DocumentRow
                  key={document.id}
                  document={document}
                  status={statusOf(document)}
                  error={state?.state === "error" ? state.message : undefined}
                  onRetry={() => void runIndex(document.id)}
                  onDelete={() => setDeleteTarget(document)}
                  onOpen={() => setOpenDocumentId(document.id)}
                />
              );
            })}
          </ul>
        )}
      </section>

      {openDocument && (
        <DocumentPanel
          document={openDocument}
          status={statusOf(openDocument)}
          error={
            openDocumentState?.state === "error"
              ? openDocumentState.message
              : undefined
          }
          onClose={() => setOpenDocumentId(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete document?"
          message={
            <>
              <strong>{deleteTarget.filename}</strong> and its indexed content
              will be permanently removed
              {isAttachment(deleteTarget) && (
                <>
                  {" "}
                  from the chat{" "}
                  <strong>
                    {deleteTarget.conversation_title ?? "it was attached to"}
                  </strong>
                </>
              )}
              .
            </>
          }
          confirmLabel="Delete"
          busyLabel="Deleting…"
          danger
          onConfirm={() => confirmDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

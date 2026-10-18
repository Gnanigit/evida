import { useRef, useState, type KeyboardEvent } from 'react'
import { CloudUpload } from 'lucide-react'

// Drag-and-drop area that also opens the file picker on click, Enter, or Space.
export default function UploadDropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  // dragenter/dragleave also fire for child elements; count them to know when the pointer truly leaves.
  const dragDepth = useRef(0)

  function openPicker() {
    inputRef.current?.click()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openPicker()
    }
  }

  return (
    <>
      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Upload PDFs. Drop files here, or press Enter to browse."
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragEnter={(event) => {
          event.preventDefault()
          dragDepth.current += 1
          setDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (dragDepth.current === 0) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          dragDepth.current = 0
          setDragging(false)
          onFiles(Array.from(event.dataTransfer.files))
        }}
      >
        <span className="dropzone-icon" aria-hidden="true">
          <CloudUpload size={24} />
        </span>
        <p className="dropzone-title">
          {dragging ? (
            'Drop to upload'
          ) : (
            <>
              Drag PDFs here, or <span className="dropzone-link">browse files</span>
            </>
          )}
        </p>
        <p className="dropzone-hint">PDF only · up to 10 MB each</p>
      </div>

      {/* Outside the drop zone, so its click does not bubble back and reopen the picker. */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []))
          // Allow choosing the same file again.
          event.target.value = ''
        }}
      />
    </>
  )
}

import { FileText } from 'lucide-react'
import type { MessageAttachment } from '../../types/api'

// File chips shown above a sent question, like ChatGPT and Claude.
export default function MessageAttachments({ files }: { files: MessageAttachment[] }) {
  if (files.length === 0) return null

  return (
    <ul className="message-files" aria-label="Attached files">
      {files.map((file) => (
        <li key={file.id} className="message-file" title={file.filename}>
          <span className="message-file-icon" aria-hidden="true">
            <FileText size={16} />
          </span>
          <span className="message-file-text">
            <span className="message-file-name">{file.filename}</span>
            <span className="message-file-type">PDF</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

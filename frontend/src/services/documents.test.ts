import { describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({ apiRequest: vi.fn() }))

const { MAX_UPLOAD_BYTES, formatFileSize, validatePdfFile } = await import('./documents')

describe('validatePdfFile', () => {
  it('accepts a PDF within the size limit', () => {
    expect(validatePdfFile({ name: 'paper.PDF', size: 1024 })).toBeNull()
    expect(validatePdfFile({ name: 'paper.pdf', size: MAX_UPLOAD_BYTES })).toBeNull()
  })

  it('rejects other file types', () => {
    expect(validatePdfFile({ name: 'notes.docx', size: 10 })).toBe('Only PDF files are allowed.')
  })

  it('rejects empty files', () => {
    expect(validatePdfFile({ name: 'empty.pdf', size: 0 })).toBe('The selected file is empty.')
  })

  it('rejects files over 10 MB', () => {
    expect(validatePdfFile({ name: 'big.pdf', size: MAX_UPLOAD_BYTES + 1 })).toBe(
      'The file must be 10 MB or smaller.',
    )
  })
})

describe('formatFileSize', () => {
  it('formats bytes, kilobytes, and megabytes', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})

/**
 * ImageUpload.tsx — Image upload field with browser-side resize + WebP.
 *
 * Accepts jpeg/png/webp/avif, max 5 MB. Resizes to 1600px wide and converts
 * to WebP before storing. Shows a preview. Never deletes from storage.
 *
 * Alt text is derived from the event title (passed in as `altPrefix`).
 */

import React, { useRef, useState } from 'react'
import { Upload, X, ImageIcon } from 'lucide-react'
import {
  processImageForUpload,
  makeImageFileName,
} from '../services/imageResize'
import { uploadEventImage } from '../services/eventsService'

interface ImageUploadProps {
  /** Current image URL (null = no image). */
  value: string | null
  /** Called when a new image is processed. Returns the uploaded public URL. */
  onChange: (url: string | null) => void
  /** Prefix for the storage file name (e.g. slug). */
  namePrefix: string
  /** Alt text shown under the field. */
  altText?: string
  /** Error message to show below the field. */
  error?: string | null
}

export function ImageUpload({
  value,
  onChange,
  namePrefix,
  altText,
  error,
}: ImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setLocalError(null)
    setProcessing(true)
    try {
      const processed = await processImageForUpload(file)
      const fileName = makeImageFileName(namePrefix)
      const url = await uploadEventImage(processed.blob, fileName)
      onChange(url)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to process image')
    } finally {
      setProcessing(false)
    }
  }

  const handleRemove = () => {
    onChange(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--text-main)]">
        Event image
      </label>

      {/* Preview */}
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-section-alt)]">
          <img
            src={value}
            alt={altText ?? 'Event image preview'}
            className="w-full h-40 object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            aria-label="Remove image"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-[var(--border-subtle)] rounded-xl bg-[var(--bg-section-alt)]/50">
          <ImageIcon size={24} className="text-[var(--text-muted)]" aria-hidden="true" />
          <p className="text-xs text-[var(--text-muted)] text-center max-w-[200px]">
            JPEG, PNG, WebP or AVIF · max 5 MB · resized to 1600 px
          </p>
        </div>
      )}

      {/* File input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
        className="hidden"
        aria-label="Upload event image"
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={processing}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-section-alt)] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"
      >
        <Upload size={16} aria-hidden="true" />
        {processing ? 'Processing…' : value ? 'Replace image' : 'Upload image'}
      </button>

      {/* Error messages */}
      {(localError || error) && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {localError ?? error}
        </p>
      )}
    </div>
  )
}

/**
 * imageResize.ts — Browser-side image resizing + WebP conversion.
 *
 * Used by the Event form to process uploads before sending to Storage.
 * - Max width: 1600 px (downscales if larger, keeps if smaller)
 * - Output: WebP quality 82
 * - Throws on non-image files or files > 5 MB
 */

export interface ProcessedImage {
  blob:  Blob
  width:  number
  height: number
}

const MAX_WIDTH = 1600
const MAX_SIZE_BYTES = 5 * 1024 * 1024  // 5 MB
const WEBP_QUALITY = 0.82

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/**
 * Validate a File: must be an accepted image type and ≤ 5 MB.
 * Throws with a user-friendly message on rejection.
 */
export function validateImageFile(file: File): void {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error(
      `Unsupported file type: ${file.type}. Accepted: JPEG, PNG, WebP, AVIF.`
    )
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum 5 MB.`
    )
  }
}

/**
 * Load a File into an HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load the image file.'))
    }
    img.src = url
  })
}

/**
 * Draw an image to a canvas at most `maxWidth` px wide, preserving aspect ratio.
 */
function drawToCanvas(img: HTMLImageElement, maxWidth: number): HTMLCanvasElement {
  const ratio = img.height / img.width
  const targetWidth = Math.min(img.width, maxWidth)
  const targetHeight = Math.round(targetWidth * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported in this browser.')
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
  return canvas
}

/**
 * Process an image File: validate, resize to max 1600px wide, convert to WebP.
 * Returns a ProcessedImage with the blob ready for upload.
 */
export async function processImageForUpload(file: File): Promise<ProcessedImage> {
  validateImageFile(file)
  const img = await loadImage(file)
  const canvas = drawToCanvas(img, MAX_WIDTH)

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('Failed to encode image to WebP.')),
      'image/webp',
      WEBP_QUALITY
    )
  })

  return {
    blob,
    width:  canvas.width,
    height: canvas.height,
  }
}

/**
 * Generate a safe storage file name for an event image.
 */
export function makeImageFileName(prefix: string): string {
  const ts = Date.now()
  return `${prefix}-${ts}.webp`
}

// Client-side image compression for progress photos.
//
// Strategy: decode the picked file, resize the longest edge to ~maxEdge px, and
// re-encode as JPEG. If ANYTHING fails (e.g. a browser that can't decode HEIC),
// fall back to the untouched original — we never block or reject an upload.
//
// Target: a 4-5MB phone photo → ~300-600KB.
//
// maxEdge is sized for the feed's fullscreen photo viewer, which zooms to 5x:
// below ~1600px you run out of real pixels and start magnifying mush. It is the
// ceiling on how much detail anyone can ever get back out of a progress photo,
// so it is deliberately generous rather than tuned for bandwidth.

const DEFAULTS = { maxEdge: 1600, quality: 0.6 }

export async function compressImage(file, opts = {}) {
  const { maxEdge, quality } = { ...DEFAULTS, ...opts }
  try {
    const { width, height, source, close } = await loadBitmap(file)
    const longest = Math.max(width, height)
    const scale = Math.min(1, maxEdge / longest)
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(source, 0, 0, w, h)
    close()

    const blob = await canvasToBlob(canvas, quality)
    if (!blob) throw new Error('canvas.toBlob returned null')

    // If we somehow made it bigger (tiny images), keep the original.
    if (blob.size >= file.size) {
      return { blob: file, ext: extOf(file), compressed: false }
    }
    return { blob, ext: 'jpg', compressed: true }
  } catch (err) {
    console.warn('Image compression failed, uploading original:', err)
    return { blob: file, ext: extOf(file), compressed: false, error: err }
  }
}

// Prefer createImageBitmap (fast, handles orientation, decodes HEIC on Safari).
// Fall back to an <img> for browsers/formats where it isn't available.
async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(file)
    return {
      width: bmp.width,
      height: bmp.height,
      source: bmp,
      close: () => bmp.close?.(),
    }
  }
  const url = URL.createObjectURL(file)
  const img = await new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = url
  })
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    source: img,
    close: () => URL.revokeObjectURL(url),
  }
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

function extOf(file) {
  const fromName = file.name?.split('.').pop()?.toLowerCase()
  if (fromName && fromName.length <= 5) return fromName
  const fromType = file.type?.split('/').pop()
  return fromType || 'bin'
}

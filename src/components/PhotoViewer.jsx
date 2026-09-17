import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// Tap a feed photo, see it full size, close it. That's the whole thing.
//
// Rendered through a portal: the card it's launched from is a positioned,
// animated element, and a fixed overlay nested inside one is at the mercy of
// whatever stacking context the ancestor happens to create — the bottom nav
// would win. On document.body there's nothing to fight.
export default function PhotoViewer({ src, alt = '', onClose }) {
  const closeRef = useRef(null)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    // Stop the feed scrolling underneath the overlay.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return createPortal(
    <div
      className="photo-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      // Tapping anywhere off the photo closes too — but the button is the
      // advertised way out, so it never depends on knowing that.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <button
        type="button"
        className="photo-close"
        ref={closeRef}
        aria-label="Close photo"
        onClick={onClose}
      >
        ×
      </button>

      <img className="photo-full" src={src} alt={alt} />
    </div>,
    document.body,
  )
}

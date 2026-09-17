import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Fullscreen photo viewer with pinch, drag and double-tap zoom.
//
// The gestures are hand-rolled rather than left to the browser because
// index.html sets `user-scalable=no` — native pinch-zoom is off across the
// whole app, and relaxing that would let every screen be zoomed and dragged
// around, which is not what a PWA with a fixed bottom nav wants.
//
// Interaction model, chosen so nothing is ambiguous:
//   · tap the backdrop  → close
//   · double-tap the photo → toggle 1x / 2.5x, centred on where you tapped
//   · pinch → zoom, drag → pan (only once zoomed in)
//   · Escape or the × → close
//
// Rendered through a portal: the card it's launched from is a positioned,
// animated element, and a fixed overlay nested inside one is at the mercy of
// whatever stacking context the ancestor happens to create — the bottom nav
// would win. On document.body there's nothing to fight.

const MIN_SCALE = 1
const MAX_SCALE = 5
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_SLOP = 30

export default function PhotoViewer({ src, alt = '', onClose }) {
  const wrapRef = useRef(null)
  const imgRef = useRef(null)
  const closeRef = useRef(null)

  const [t, setT] = useState({ s: 1, x: 0, y: 0 })

  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const lastTap = useRef({ time: 0, x: 0, y: 0 })

  // Keep the image inside the viewport: at 1x it never moves, and zoomed in it
  // can only travel as far as the overflow it actually has.
  const clamp = useCallback((next) => {
    const img = imgRef.current
    const wrap = wrapRef.current
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.s))
    if (!img || !wrap) return { s, x: next.x, y: next.y }

    // offsetWidth is the layout size, unaffected by the transform we apply.
    const maxX = Math.max(0, (img.offsetWidth * s - wrap.clientWidth) / 2)
    const maxY = Math.max(0, (img.offsetHeight * s - wrap.clientHeight) / 2)
    return {
      s,
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    }
  }, [])

  // Container coordinates, origin at the centre — the same space the transform
  // works in, so zoom maths stays simple.
  const toLocal = useCallback((clientX, clientY) => {
    const r = wrapRef.current?.getBoundingClientRect()
    if (!r) return { x: 0, y: 0 }
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 }
  }, [])

  // Zoom so the point under the finger stays under the finger.
  const zoomAt = useCallback(
    (localX, localY, nextScale) => {
      setT((prev) => {
        const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale))
        const k = s / prev.s
        return clamp({ s, x: localX - (localX - prev.x) * k, y: localY - (localY - prev.y) * k })
      })
    },
    [clamp],
  )

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

  function pointerDown(e) {
    // Only the photo takes gestures. Capturing on anything else would retarget
    // the close button's click to the overlay and swallow it; the backdrop and
    // the × are left entirely to onClick.
    if (e.target !== imgRef.current) return

    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const mid = toLocal((a.x + b.x) / 2, (a.y + b.y) / 2)
      gesture.current = {
        mode: 'pinch',
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: mid.x,
        my: mid.y,
        start: t,
      }
    } else if (pointers.current.size === 1) {
      gesture.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, start: t, moved: false }
    }
  }

  function pointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return

    if (g.mode === 'pinch' && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      const mid = toLocal((a.x + b.x) / 2, (a.y + b.y) / 2)
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, g.start.s * (dist / g.dist)))
      const k = s / g.start.s
      // Zoom about where the pinch began, then follow the midpoint as it moves.
      setT(
        clamp({
          s,
          x: g.mx - (g.mx - g.start.x) * k + (mid.x - g.mx),
          y: g.my - (g.my - g.start.y) * k + (mid.y - g.my),
        }),
      )
      return
    }

    if (g.mode === 'pan' && pointers.current.size === 1) {
      const dx = e.clientX - g.sx
      const dy = e.clientY - g.sy
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) g.moved = true
      // At 1x there's nothing to pan — leave the photo put.
      if (g.start.s > 1) setT(clamp({ s: g.start.s, x: g.start.x + dx, y: g.start.y + dy }))
    }
  }

  function pointerUp(e) {
    const wasTap = gesture.current?.mode === 'pan' && !gesture.current.moved
    pointers.current.delete(e.pointerId)

    if (pointers.current.size === 0) {
      gesture.current = null
      if (wasTap) {
        const now = Date.now()
        const prev = lastTap.current
        const quick = now - prev.time < DOUBLE_TAP_MS
        const near =
          Math.abs(e.clientX - prev.x) < DOUBLE_TAP_SLOP &&
          Math.abs(e.clientY - prev.y) < DOUBLE_TAP_SLOP

        if (quick && near) {
          const p = toLocal(e.clientX, e.clientY)
          if (t.s > 1) setT({ s: 1, x: 0, y: 0 })
          else zoomAt(p.x, p.y, 2.5)
          lastTap.current = { time: 0, x: 0, y: 0 }
        } else {
          lastTap.current = { time: now, x: e.clientX, y: e.clientY }
        }
      }
    } else if (pointers.current.size === 1) {
      // Coming out of a pinch: restart panning from the finger still down.
      const [only] = [...pointers.current.values()]
      gesture.current = { mode: 'pan', sx: only.x, sy: only.y, start: t, moved: true }
    }
  }

  // Desktop: wheel / trackpad pinch.
  function wheel(e) {
    const p = toLocal(e.clientX, e.clientY)
    zoomAt(p.x, p.y, t.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15))
  }

  return createPortal(
    <div
      className="photo-overlay"
      ref={wrapRef}
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      onWheel={wheel}
      onClick={(e) => {
        if (e.target === wrapRef.current) onClose()
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

      <img
        ref={imgRef}
        className="photo-full"
        src={src}
        alt={alt}
        draggable="false"
        style={{
          transform: `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.s})`,
          // Only animate the snap back to 1x, never a live gesture.
          transition: gesture.current ? 'none' : 'transform 0.18s ease-out',
          cursor: t.s > 1 ? 'grab' : 'zoom-in',
        }}
      />

      {t.s === 1 && <p className="photo-hint">Double-tap to zoom</p>}
    </div>,
    document.body,
  )
}

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MEASUREMENTS, unitFor, labelFor } from '../lib/measurements'
import { fmtDay } from '../lib/day'

// Two photos side by side — the reason anyone takes progress photos at all.
//
// Portrait phone, portrait bodies: two half-width columns beats any stacked
// layout, and beats a swipe/slider, which hides half of what you came to see.
//
// If both posts carry the same measurement, the change comes along for free.
// That is the part a photo alone can't tell you.
export default function PhotoCompare({ a, b, onClose }) {
  const closeRef = useRef(null)

  // Oldest on the left, so it reads left-to-right as time passing.
  const [left, right] = a.date <= b.date ? [a, b] : [b, a]

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return createPortal(
    <div className="compare-overlay" role="dialog" aria-modal="true" aria-label="Compare photos">
      <header className="compare-head">
        <span className="compare-gap">{gapLabel(left.date, right.date)}</span>
        <button
          type="button"
          className="photo-close compare-close"
          ref={closeRef}
          aria-label="Close comparison"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="compare-panes">
        {[left, right].map((p, i) => (
          <figure className="compare-pane" key={p.targetKey}>
            <img src={p.photoUrl} alt={`Photo from ${p.date}`} />
            <figcaption>
              <span className="compare-label">{i === 0 ? 'Before' : 'After'}</span>
              <span className="compare-date">{fmtDay(p.date)}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <Deltas left={left} right={right} />
    </div>,
    document.body,
  )
}

// Only measurements present on BOTH posts can be compared; check-ins have none,
// so most comparisons show nothing here and that is fine.
function Deltas({ left, right }) {
  const shared = MEASUREMENTS.filter(
    (m) => left.payload?.[m.key] != null && right.payload?.[m.key] != null,
  )
  if (shared.length === 0) return null

  return (
    <div className="compare-deltas">
      {shared.map((m) => {
        const diff = Math.round((right.payload[m.key] - left.payload[m.key]) * 10) / 10
        const isProgress = m.lowerIsProgress ? diff < 0 : diff > 0
        const cls = diff === 0 ? 'flat' : isProgress ? 'good' : 'bad'
        return (
          <span className="compare-delta" key={m.key}>
            <span className="muted">{labelFor(m.key)}</span>
            <span className={`delta-value ${cls}`}>
              {diff === 0 ? 'no change' : `${diff > 0 ? '+' : ''}${diff} ${unitFor(m.key)}`}
            </span>
          </span>
        )
      })}
    </div>
  )
}

function gapLabel(from, to) {
  const days = Math.round((new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000)
  if (days === 0) return 'Same day'
  if (days === 1) return '1 day apart'
  if (days < 14) return `${days} days apart`
  if (days < 60) return `${Math.round(days / 7)} weeks apart`
  return `${Math.round(days / 30)} months apart`
}

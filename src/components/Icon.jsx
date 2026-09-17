// Measurement icons.
//
// One shared visual system: a simplified figure with a highlighted band at the
// spot being measured, so the six circumference metrics read as a family
// rather than six unrelated pictures. Weight is the odd one out — it isn't a
// circumference — so it gets a scale instead.
//
// Inline SVG on purpose: no icon-font dependency, inherits currentColor, and
// stays crisp at any size. The band uses the accent so the eye lands on the
// part that differs between icons.

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

// Head, torso, arms, legs — identical in every circumference icon.
function Figure() {
  return (
    <g {...S} opacity={0.45}>
      <circle cx="12" cy="4" r="2.1" />
      <path d="M12 6.4V15" />
      <path d="M12 8.2 6.6 12M12 8.2l5.4 3.8" />
      <path d="M12 15l-2.4 6M12 15l2.4 6" />
    </g>
  )
}

// The measuring band, drawn over the figure in the accent colour.
function Band({ d }) {
  return <path d={d} {...S} strokeWidth={2.1} stroke="var(--accent)" />
}

function Circumference({ band }) {
  return (
    <>
      <Figure />
      <Band d={band} />
    </>
  )
}

const SHAPES = {
  // A bathroom scale, viewed from above: platform plus a dial needle.
  weight: (
    <g {...S}>
      <rect x="3" y="5.5" width="18" height="13" rx="3" />
      <path d="M8.4 14.6a4.2 4.2 0 0 1 7.2 0" />
      <path d="M12 14.6 14 11.4" />
    </g>
  ),
  chest: <Circumference band="M7.7 9.9h8.6" />,
  waist: <Circumference band="M8.9 12.6h6.2" />,
  hips: <Circumference band="M8.4 14.9h7.2" />,
  // Band wraps the upper arm, perpendicular to the limb.
  arm: <Circumference band="M13.9 9.3 16.8 12" />,
  // Band wraps the upper leg.
  thigh: <Circumference band="M12.4 17.6 15.4 18.6" />,
}

export default function Icon({ name, size = 20, className, ...rest }) {
  const shape = SHAPES[name]
  if (!shape) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {shape}
    </svg>
  )
}

// Piccolo spinner SVG che gira. Usalo come indicatore di caricamento
// nei bottoni async:
//
//   <button disabled={loading}>
//     {loading ? <Spinner /> : null} Prenota
//   </button>
//
// Il size di default e' 14px (si usa a fianco del testo nei bottoni).
// Accetta className per override di colore (ereditato da currentColor).
export default function Spinner({ size = 14, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin inline-block ${className}`}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="40 60"
        opacity="0.9"
      />
    </svg>
  )
}

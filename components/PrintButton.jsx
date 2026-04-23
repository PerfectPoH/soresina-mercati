'use client'

export default function PrintButton({ className = '', children = 'Stampa' }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className || 'text-sm px-4 py-2 rounded-lg text-white font-medium'}
      style={{ background: '#BA7517' }}
    >
      {children}
    </button>
  )
}

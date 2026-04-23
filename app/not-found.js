import Link from 'next/link'

export const metadata = {
  title: 'Pagina non trovata — Mercati Soresina',
}

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl p-8 text-center">
        <div
          className="text-6xl font-light mb-2"
          style={{ color: '#BA7517' }}
          aria-hidden="true"
        >
          404
        </div>
        <h1 className="text-xl font-medium text-stone-900 mb-2">Pagina non trovata</h1>
        <p className="text-stone-500 text-sm mb-6">
          La pagina che cerchi non esiste o è stata spostata.
          Magari l'evento è stato archiviato o hai digitato l'indirizzo in modo diverso.
        </p>
        <div className="flex gap-2 justify-center">
          <Link
            href="/"
            className="text-sm px-4 py-2 rounded-lg text-white font-medium no-underline"
            style={{ background: '#BA7517' }}
          >
            Torna ai mercati
          </Link>
        </div>
      </div>
    </div>
  )
}

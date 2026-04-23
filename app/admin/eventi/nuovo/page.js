import NewEventForm from '@/components/NewEventForm'
import Link from 'next/link'

export default function NuovoEventoPage() {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-stone-400 mb-6">
        <Link href="/admin" className="hover:text-stone-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-stone-700">Nuovo evento</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-medium text-stone-900">Crea nuovo evento</h1>
        <p className="text-stone-400 text-sm mt-1">
          Le bancarelle vengono generate automaticamente in base alla configurazione della griglia
        </p>
      </div>

      <NewEventForm />
    </div>
  )
}

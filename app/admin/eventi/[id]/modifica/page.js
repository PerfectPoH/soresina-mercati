import { createSupabaseServerClient } from '@/lib/supabase-server'
import EventForm from '@/components/EventForm'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

async function getEvent(id) {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data
}

export default async function ModificaEventoPage({ params }) {
  const event = await getEvent(params.id)
  if (!event) notFound()

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-stone-400 mb-6">
        <Link href="/admin" className="hover:text-stone-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-stone-700">Modifica evento</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-medium text-stone-900">Modifica {event.title}</h1>
        <p className="text-stone-400 text-sm mt-1">
          Puoi <strong>aumentare</strong> righe e colonne per aggiungere posteggi (le posizioni sulla mappa vengono ereditate dall'ultimo evento alla stessa location). Diminuire righe/colonne non è supportato perché distruggerebbe le prenotazioni esistenti.
        </p>
      </div>

      <EventForm initialEvent={event} />
    </div>
  )
}

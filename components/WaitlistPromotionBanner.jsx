import { createSupabaseServerClient } from '@/lib/supabase-server'
import WaitlistPromotionBannerClient from './WaitlistPromotionBannerClient'

// Banner globale (server component) che avvisa l'utente loggato quando ha
// uno o piu' bookings PENDING nati da una promozione della lista d'attesa
// (BUG-041 → from_waitlist=true). L'utente ha 24h dalla promozione per
// completare il pagamento, altrimenti il cron release_expired_waitlist_promotions
// libera il posto e promuove il prossimo in lista.
//
// Renderizzato da `app/layout.js` sopra il <Header>: la query e' veloce
// (indice su user_id + status, < 5ms su DB Pro Loco) e gira solo se c'e'
// una sessione attiva, quindi non penalizza il TTFB delle pagine pubbliche.
export default async function WaitlistPromotionBanner() {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const todayIso = new Date().toISOString().slice(0, 10)

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, status, from_waitlist, waitlist_promoted_at, created_at, paid_price,
      events ( id, title, date ),
      stalls ( id, label )
    `)
    .eq('user_id', session.user.id)
    .eq('status', 'pending')
    .eq('from_waitlist', true)
    .order('waitlist_promoted_at', { ascending: true })

  const list = (bookings || [])
    // Filtra eventi rimossi (RLS) o gia' passati: in quel caso il booking
    // non e' completabile, mostrare il banner sarebbe disorientante.
    .filter(b => b.events && b.events.date && b.events.date >= todayIso)
    .map(b => ({
      id: b.id,
      eventTitle: b.events.title,
      eventDate: b.events.date,
      stallLabel: b.stalls?.label || '',
      // Le 24h scattano dal promoted_at. Se e' null (vecchi pending),
      // usiamo created_at come fallback.
      promotedAt: b.waitlist_promoted_at || b.created_at,
      paidPrice: Number(b.paid_price ?? 0),
    }))

  if (list.length === 0) return null

  return <WaitlistPromotionBannerClient bookings={list} />
}

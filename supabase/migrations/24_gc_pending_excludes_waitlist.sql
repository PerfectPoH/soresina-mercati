-- BUG-051 (Codex audit 2026-05-04): release_expired_pending_bookings()
-- cancellava TUTTI i pending dopo 15 minuti, inclusi i pending creati da
-- promote_next_waitlist (BUG-041) che dovrebbero durare 24h.
--
-- Conseguenza: una promozione waitlist si traduceva in un booking pending
-- con `from_waitlist=true` che pero' veniva cancellato dal GC Stripe dopo
-- 15 minuti, non dopo 24h come promesso dal banner e dall'email.
--
-- Fix: il GC Stripe esclude esplicitamente i pending nati da waitlist.
-- I waitlist pending hanno il loro cron dedicato `release_expired_waitlist_promotions`
-- (migration 19) che li cancella dopo 24h dalla `waitlist_promoted_at`.

create or replace function public.release_expired_pending_bookings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update bookings
    set status = 'cancelled'
    where status = 'pending'
      and created_at < now() - interval '15 minutes'
      -- BUG-051: i pending da waitlist hanno TTL di 24h, gestiti dal cron
      -- release_expired_waitlist_promotions(). Non toccarli qui.
      and coalesce(from_waitlist, false) = false;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.release_expired_pending_bookings() is
  'Cron Stripe: cancella i pending creati da checkout abbandonati (no payment entro 15 min). Esclude i pending da waitlist (BUG-051): quelli hanno TTL 24h gestito da release_expired_waitlist_promotions().';

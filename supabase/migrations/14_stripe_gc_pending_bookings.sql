-- ============================================================
-- 14_stripe_gc_pending_bookings.sql
-- ============================================================
-- Garbage collection delle prenotazioni in stato 'pending' scadute.
--
-- Quando un utente avvia il checkout Stripe il booking parte come
-- 'pending'. Se non porta a termine il pagamento (chiude la pagina,
-- abbandona, ecc.) il posteggio resta bloccato. Stripe genera un
-- evento 'checkout.session.expired' dopo ~24h, ma serve un fallback
-- piu' rapido perche' altri utenti possano riprenotare.
--
-- pg_cron schedula la pulizia ogni 5 minuti.
-- ============================================================

create extension if not exists pg_cron with schema extensions;

create or replace function public.release_expired_pending_bookings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update bookings
    set status = 'cancelled'
    where status = 'pending'
      and created_at < now() - interval '15 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

select cron.schedule(
  'stripe-gc-pending-bookings',
  '*/5 * * * *',
  $$ select public.release_expired_pending_bookings(); $$
);

-- BUG-030: il trigger contava solo le bookings 'confirmed'.
-- Conseguenza: utente con 2 confirmed → 3a INSERT come 'pending' passava
-- → Stripe addebitava → webhook UPDATE pending→confirmed bloccato dal trigger
-- → silent failure + addebito senza prenotazione.
-- Fix: includere anche 'pending' nel conteggio, escludendo l'id corrente
-- (cosi' UPDATE pending→confirmed dello stesso record passa).
create or replace function public.enforce_booking_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  current_count int;
begin
  if NEW.status in ('confirmed','pending') and NEW.user_id is not null and not public.is_admin() then
    select count(*) into current_count
      from bookings
      where user_id  = NEW.user_id
        and event_id = NEW.event_id
        and status in ('confirmed','pending')
        and id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    if current_count >= 2 then
      raise exception 'Hai raggiunto il limite di 2 posteggi per questo evento'
        using errcode = 'P0001';
    end if;
  end if;
  return NEW;
end;
$$;

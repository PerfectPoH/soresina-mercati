-- BUG-047: il prezzo della prenotazione era ricalcolato ogni volta che si
-- leggeva la dashboard ("incasso stimato") usando lo stato CORRENTE di
-- `events.price_per_stall` o `stalls.price`. Se l'admin modificava il prezzo
-- dopo che l'utente aveva gia' prenotato, l'incasso storico saltava
-- retroattivamente, mostrando importi diversi da quelli realmente pagati.
--
-- Fix: snapshot del prezzo al momento della creazione del booking in una
-- nuova colonna immutabile `paid_price`. Da quel momento la dashboard e ogni
-- altra UI che mostra "quanto ha pagato l'utente" leggono dalla colonna
-- snapshot, non piu' dai valori live di stalls/events.
--
-- Backfill: per le righe esistenti popoliamo `paid_price` con il valore che
-- il dashboard MOSTRAVA finora, cioe' coalesce(stalls.price, events.price_per_stall).
-- Se in passato non hai modificato i prezzi degli eventi, e' il prezzo
-- corretto. Se li hai modificati, e' il valore a cui la UI faceva gia'
-- riferimento, quindi non c'e' regressione percepita.

alter table bookings
  add column if not exists paid_price numeric(10,2);

-- Backfill: usa il prezzo corrente per le righe esistenti.
-- LEFT JOIN per gestire stalls eliminati (improbabile dato ON DELETE CASCADE,
-- ma difensivo) e events eliminati (idem).
update bookings b
   set paid_price = coalesce(s.price, e.price_per_stall, 0)
  from stalls s, events e
 where b.stall_id = s.id
   and b.event_id = e.id
   and b.paid_price is null;

-- Comment per documentare la colonna.
comment on column bookings.paid_price is
  'Snapshot del prezzo al momento della creazione del booking (BUG-047). Immutabile dopo la creazione: rappresenta il valore realmente pagato dall''utente. NON modificare anche se admin cambia events.price_per_stall successivamente.';

-- BUG-047 follow-up: anche promote_next_waitlist deve snapshottare il prezzo
-- al momento in cui il booking pending viene creato. Senza questo, il booking
-- nasce con paid_price=NULL e finche' l'utente non clicca "Completa" la
-- dashboard non sa quanto sta per essere pagato.
create or replace function public.promote_next_waitlist(p_event_id uuid, p_stall_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_entry record;
  v_booking_id uuid;
  v_event_ok boolean;
  v_price numeric(10,2);
begin
  select (active = true and date >= current_date) into v_event_ok from events where id = p_event_id;
  if not coalesce(v_event_ok, false) then return null; end if;

  -- Snapshot prezzo: priorita' a stalls.price (override per posto), fallback
  -- a events.price_per_stall (default evento), 0 se nulli.
  select coalesce(s.price, e.price_per_stall, 0) into v_price
    from stalls s, events e
   where s.id = p_stall_id and e.id = p_event_id;

  select * into v_entry from waitlist
    where event_id = p_event_id and (stall_id = p_stall_id or stall_id is null)
    order by (case when stall_id = p_stall_id then 0 else 1 end), created_at limit 1;
  if v_entry.id is null then return null; end if;
  begin
    insert into bookings (stall_id, event_id, user_id, vendor_name, vendor_phone, vendor_email,
      goods_type, status, notes, from_waitlist, waitlist_promoted_at, paid_price)
    values (p_stall_id, p_event_id, v_entry.user_id, v_entry.vendor_name, v_entry.vendor_phone, v_entry.vendor_email,
      v_entry.goods_type, 'pending', v_entry.notes, true, now(), v_price)
    returning id into v_booking_id;
  exception when sqlstate 'P0001' then
    delete from waitlist where id = v_entry.id;
    return public.promote_next_waitlist(p_event_id, p_stall_id);
  when unique_violation then return null;
  end;
  delete from waitlist where id = v_entry.id;
  return v_booking_id;
end; $$;

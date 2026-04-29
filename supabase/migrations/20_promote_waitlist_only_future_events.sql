-- BUG-042: promote_next_waitlist ora rifiuta eventi passati o archiviati.
-- Senza questo check, l'admin poteva promuovere su un evento gia' concluso
-- → booking pending non confermabile (bloccato dai check su event_past) →
-- "in attesa" eterno + "Evento senza nome" nel profilo (RLS nasconde
-- events inactive ai non-admin).
create or replace function public.promote_next_waitlist(p_event_id uuid, p_stall_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_entry record; v_booking_id uuid; v_event_ok boolean;
begin
  select (active = true and date >= current_date) into v_event_ok from events where id = p_event_id;
  if not coalesce(v_event_ok, false) then return null; end if;
  select * into v_entry from waitlist
    where event_id = p_event_id and (stall_id = p_stall_id or stall_id is null)
    order by (case when stall_id = p_stall_id then 0 else 1 end), created_at limit 1;
  if v_entry.id is null then return null; end if;
  begin
    insert into bookings (stall_id, event_id, user_id, vendor_name, vendor_phone, vendor_email,
      goods_type, status, notes, from_waitlist, waitlist_promoted_at)
    values (p_stall_id, p_event_id, v_entry.user_id, v_entry.vendor_name, v_entry.vendor_phone, v_entry.vendor_email,
      v_entry.goods_type, 'pending', v_entry.notes, true, now())
    returning id into v_booking_id;
  exception when sqlstate 'P0001' then
    delete from waitlist where id = v_entry.id;
    return public.promote_next_waitlist(p_event_id, p_stall_id);
  when unique_violation then return null;
  end;
  delete from waitlist where id = v_entry.id;
  return v_booking_id;
end; $$;

-- Cleanup: cancella bookings pending residui creati da promote su eventi
-- ormai passati/archiviati. Idempotente.
update bookings b
   set status = 'cancelled'
  where b.status = 'pending'
    and exists (
      select 1 from events e
      where e.id = b.event_id and (e.date < current_date or e.active = false)
    );

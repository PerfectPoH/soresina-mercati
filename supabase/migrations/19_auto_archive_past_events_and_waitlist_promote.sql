-- BUG-039: auto-archive eventi passati (cron giornaliero).
create or replace function public.archive_past_events()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  update events set active = false where active = true and date < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

select cron.schedule('archive-past-events', '15 3 * * *', $$ select public.archive_past_events(); $$);

-- BUG-041: waitlist generale o specifica per posto + promozione automatica.
alter table waitlist add column if not exists stall_id uuid references stalls(id) on delete cascade;
create index if not exists waitlist_stall_idx on waitlist(stall_id) where stall_id is not null;

alter table bookings
  add column if not exists from_waitlist           boolean not null default false,
  add column if not exists waitlist_promoted_at    timestamptz;

create or replace function public.promote_next_waitlist(p_event_id uuid, p_stall_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_entry record; v_booking_id uuid;
begin
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

grant execute on function public.promote_next_waitlist(uuid, uuid) to authenticated;
grant execute on function public.archive_past_events() to authenticated;

-- Cron orario: cancella pending da waitlist scaduti (>24h) e ri-promuove
-- il prossimo. Distinto dal GC pending Stripe (15 min).
create or replace function public.release_expired_waitlist_promotions()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer := 0; r record; promoted uuid;
begin
  for r in select id, event_id, stall_id from bookings
    where status = 'pending' and from_waitlist = true
      and waitlist_promoted_at < now() - interval '24 hours'
  loop
    update bookings set status = 'cancelled' where id = r.id;
    v_count := v_count + 1;
    promoted := public.promote_next_waitlist(r.event_id, r.stall_id);
  end loop;
  return v_count;
end; $$;

select cron.schedule('release-expired-waitlist-promotions', '7 * * * *', $$ select public.release_expired_waitlist_promotions(); $$);

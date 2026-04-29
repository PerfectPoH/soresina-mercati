-- BUG-043: request_booking_cancellation rifiuta cancellation request
-- su prenotazioni di eventi passati. La UI nasconde gia' il bottone,
-- ma una chiamata diretta all'API/RPC bypassava il controllo.
create or replace function public.request_booking_cancellation(
  p_booking_id uuid, p_reason text default null
)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_owner uuid; v_status text;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select user_id, status into v_owner, v_status from bookings where id = p_booking_id;
  if v_owner is null then return false; end if;
  if v_owner <> v_uid then return false; end if;
  if v_status not in ('confirmed','pending') then return false; end if;
  if exists (
    select 1 from bookings b join events e on e.id = b.event_id
    where b.id = p_booking_id and e.date < current_date
  ) then return false; end if;
  update bookings
    set cancellation_requested_at = coalesce(cancellation_requested_at, now()),
        cancellation_reason       = nullif(trim(coalesce(p_reason,'')), '')
    where id = p_booking_id and user_id = v_uid;
  return true;
end; $$;

-- ============================================================
-- 15_view_add_event_title_default_price.sql
-- ============================================================
-- BUG-026: la view stalls_with_status non aveva event_title ne'
-- default_price. app/api/book/route.js le seleziona da sempre, ma
-- PostgREST restituiva errore silenzioso (mascherato dal vecchio
-- codice che ignorava stallErr). Il fix BUG-020 ha aggiunto il
-- check stallErr → la build lo ha smascherato come 500.
--
-- Ricostruiamo la view con join su events, mantenendo tutta la
-- logica LATERAL/stato esistente (blocked > booked > pending > free).
-- ============================================================

drop view if exists stalls_with_status;

create view stalls_with_status as
select
  s.id,
  s.event_id,
  s.label,
  s.row_idx,
  s.col_idx,
  s.price,
  s.notes,
  s.blocked,
  s.blocked_reason,
  s.latitude,
  s.longitude,
  s.created_at,
  e.title           as event_title,
  e.date            as event_date,
  e.price_per_stall as default_price,
  case
    when s.blocked then 'blocked'
    when b_confirmed.id is not null then 'booked'
    when b_pending.id   is not null then 'pending'
    else 'free'
  end as stall_status,
  b_confirmed.id          as booking_id,
  b_confirmed.vendor_name,
  b_confirmed.goods_type,
  b_confirmed.user_id     as booked_by_user
from stalls s
  join events e on e.id = s.event_id
  left join lateral (
    select id, vendor_name, goods_type, user_id
    from bookings
    where stall_id = s.id and status = 'confirmed'
    limit 1
  ) b_confirmed on true
  left join lateral (
    select id
    from bookings
    where stall_id = s.id and status = 'pending'
    limit 1
  ) b_pending on true;

grant select on stalls_with_status to anon, authenticated;

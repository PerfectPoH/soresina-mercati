-- Quando si crea un nuovo evento (o si aggiungono posteggi a uno esistente),
-- copia le coordinate latitude/longitude dei posteggi con label uguale
-- dall'ULTIMO evento alla stessa location. Cosi' l'admin non deve
-- riposizionare ogni posteggio sulla mappa satellitare a ogni evento.
create or replace function public.copy_stall_positions_from_template(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location text;
  v_template_event_id uuid;
  v_count integer := 0;
begin
  select location into v_location from events where id = p_event_id;
  if v_location is null then return 0; end if;

  select e.id into v_template_event_id
    from events e
    where e.location = v_location
      and e.id <> p_event_id
      and exists (
        select 1 from stalls s
        where s.event_id = e.id
          and s.latitude is not null
          and s.longitude is not null
      )
    order by e.created_at desc
    limit 1;

  if v_template_event_id is null then return 0; end if;

  with src as (
    select label, latitude, longitude
    from stalls
    where event_id = v_template_event_id
      and latitude is not null
      and longitude is not null
  )
  update stalls dst
     set latitude  = src.latitude,
         longitude = src.longitude
    from src
   where dst.event_id = p_event_id
     and dst.label    = src.label
     and dst.latitude is null
     and dst.longitude is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.copy_stall_positions_from_template(uuid) to authenticated;

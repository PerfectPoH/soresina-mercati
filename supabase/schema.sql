-- ============================================================
-- Schema: Mercati Soresina — Pro Loco
-- Esegui questo file nell'SQL Editor di Supabase
-- ============================================================

-- Tabella eventi
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  date        date not null,
  location    text not null default 'Piazza Garibaldi, Soresina',
  rows        int  not null default 5,
  cols        int  not null default 8,
  price_per_stall numeric(6,2) not null default 35.00,
  active      boolean not null default true,
  created_at  timestamptz default now()
);

-- Tabella bancarelle (generate automaticamente per ogni evento)
create table if not exists stalls (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid references events(id) on delete cascade,
  label      text not null,       -- es. "A01", "B03"
  row_idx    int  not null,
  col_idx    int  not null,
  price      numeric(6,2),        -- override del prezzo evento se serve
  notes      text,
  created_at timestamptz default now(),
  unique(event_id, label)
);

-- Tabella prenotazioni
create table if not exists bookings (
  id           uuid primary key default gen_random_uuid(),
  stall_id     uuid references stalls(id) on delete cascade,
  event_id     uuid references events(id) on delete cascade,
  vendor_name  text not null,
  vendor_phone text,
  vendor_email text,
  goods_type   text not null,
  status       text not null default 'confirmed'
                check (status in ('confirmed', 'cancelled', 'pending')),
  notes        text,
  created_at   timestamptz default now()
);

-- Indici per performance
create index if not exists stalls_event_id_idx    on stalls(event_id);
create index if not exists bookings_stall_id_idx  on bookings(stall_id);
create index if not exists bookings_event_id_idx  on bookings(event_id);

-- View comoda: bancarelle con stato prenotazione
create or replace view stalls_with_status as
select
  s.*,
  e.title        as event_title,
  e.date         as event_date,
  e.price_per_stall as default_price,
  b.id           as booking_id,
  b.vendor_name,
  b.vendor_phone,
  b.goods_type,
  b.status       as booking_status,
  case
    when b.id is not null and b.status = 'confirmed' then 'busy'
    else 'free'
  end            as stall_status
from stalls s
join events e on e.id = s.event_id
left join bookings b on b.stall_id = s.id and b.status = 'confirmed';

-- Dati di esempio (3 eventi)
insert into events (title, description, date, rows, cols, price_per_stall) values
  ('Mercato di Maggio',    'Mercato primaverile in piazza',          '2025-05-18', 5, 8, 35.00),
  ('Festa dell''Estate',   'Mercato estivo con spettacoli serali',   '2025-06-14', 6, 8, 40.00),
  ('Sagra Settembrina',    'Sagra autunnale con prodotti tipici',     '2025-09-20', 5, 8, 35.00)
on conflict do nothing;

-- Funzione per generare le bancarelle di un evento
create or replace function generate_stalls(p_event_id uuid)
returns void language plpgsql as $$
declare
  ev record;
  r int; c int;
  row_letter text;
  label text;
begin
  select rows, cols into ev from events where id = p_event_id;
  for r in 0..(ev.rows - 1) loop
    row_letter := chr(65 + r);  -- A, B, C, ...
    for c in 1..ev.cols loop
      label := row_letter || lpad(c::text, 2, '0');
      insert into stalls (event_id, label, row_idx, col_idx)
      values (p_event_id, label, r, c - 1)
      on conflict (event_id, label) do nothing;
    end loop;
  end loop;
end;
$$;

-- Genera le bancarelle per gli eventi di esempio
do $$
declare ev record;
begin
  for ev in select id from events loop
    perform generate_stalls(ev.id);
  end loop;
end;
$$;

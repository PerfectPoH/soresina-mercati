-- ============================================================
-- 13_stripe_events_seen.sql
-- ============================================================
-- Tabella per idempotency dei webhook Stripe.
--
-- Stripe puo' rinviare lo stesso evento (timeout di rete, retry policy):
-- la primary key + INSERT...ON CONFLICT serve come lock atomico.
-- Il webhook (lib/supabase-admin.js + app/api/webhooks/stripe/route.js)
-- gira con service role e bypassa RLS.
-- ============================================================

create table if not exists stripe_events_seen (
  id           text primary key,
  type         text,
  processed_at timestamptz not null default now()
);

create index if not exists stripe_events_seen_processed_at_idx
  on stripe_events_seen(processed_at desc);

-- RLS abilitato senza policy pubblica = default-deny per anon.
-- L'admin client (service role) usato dal webhook bypassa RLS.
alter table stripe_events_seen enable row level security;

drop policy if exists "stripe_events_seen_admin_read" on stripe_events_seen;
create policy "stripe_events_seen_admin_read" on stripe_events_seen
  for select using (public.is_admin());

# Migrations Archive

Storia cronologica delle migrazioni applicate al DB di produzione (`ddqwutxocznggfmrzzkw`) e staging (`yctfshlwgouhppadptgy`).

**Non eseguire direttamente questi file su un nuovo DB.** Usa invece `supabase/schema.sql`, che è il dump consolidato e idempotente dello stato corrente. Questi file servono come riferimento per audit, debug, e per capire perché certe scelte sono state fatte.

## Cronologia (in ordine di applicazione)

| # | File | Topic | Note |
|---|---|---|---|
| 02 | `02_rls.sql` | Policy RLS base | Prime policy su events/stalls/bookings |
| 03 | `03_fix_rls_security_definer_view.sql` | Fix view RLS-safe | Funzioni `stall_status_of` + `stall_vendor_name` |
| 04 | `04_auth_vendors.sql` | Tabella `vendors` + `is_admin()` | Sistema auth admin/vendor |
| 05 | `05_features_blocked_waitlist.sql` | Stalls.blocked + waitlist | Feature operative admin |
| 06 | `06_security_audit_log.sql` | Audit log + RLS tightening | Trigger su events/stalls/bookings |
| 07 | `07_fix_stalls_read_rls.sql` | Ripristino policy SELECT su stalls | |
| 08 | `08_gdpr.sql` | `delete_my_account()` ecc | Diritto cancellazione |
| 09 | `09_realtime_publication.sql` | Realtime publication su bookings/stalls | Replica identity full |

Le migrazioni 10-12 (image_url, geo coords, harden function search_path) e 13-14 (stripe_events_seen, pg_cron GC) sono state assorbite nel `schema.sql` consolidato. La cartella `supabase/migrations/` contiene solo le migration "vive" non ancora consolidate (13 e 14).

-- BUG-045: l'admin che cancella forzatamente una prenotazione (con o senza
-- rimborso) deve poter inserire un motivo che viene salvato e mostrato
-- all'utente. La colonna `cancellation_reason` esistente serve al motivo
-- che l'utente passa quando RICHIEDE la cancellazione, quindi serve una
-- colonna distinta per il motivo lato admin.
alter table bookings
  add column if not exists admin_cancel_reason  text,
  add column if not exists admin_refunded       boolean,
  add column if not exists admin_cancelled_at   timestamptz;

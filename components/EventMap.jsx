// DEPRECATED — sostituito da StallMapSatellite (vista Leaflet + marker
// interattivi sui posteggi). Questo file resta solo come segnaposto per
// evitare che import storici (es. da branch locali o commit in corso)
// provochino build error. Puo' essere eliminato dopo aver verificato che
// nessun altro file lo importi.
//
// Motivazione della rimozione: l'iframe Google Maps era statico (non
// sapeva nulla dei posteggi) e l'utente voleva cliccare i posteggi sulla
// mappa satellite. Vedi StallMapSatellite.jsx per la nuova implementazione.
export default function EventMap() {
  return null
}

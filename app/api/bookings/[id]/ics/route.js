import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/rate-limit'
import { safeLogError } from '@/lib/log'
import { validateUuid } from '@/lib/validate'

// GET /api/bookings/[id]/ics
// Genera un file .ics (iCalendar) scaricabile per aggiungere la
// prenotazione al calendario personale (Apple Calendar, Google Calendar,
// Outlook). Riguarda solo prenotazioni confirmed.
// Autorizzazione via RLS: solo proprietario o admin.
export async function GET(request, { params }) {
  try {
    const limited = enforceRateLimit(request, { prefix: 'ics', limit: 20, windowMs: 60_000 })
    if (limited) return limited

    const idCheck = validateUuid(params.id, { field: 'id' })
    if (!idCheck.ok) {
      return NextResponse.json({ error: 'invalid_input', message: idCheck.error }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'not_authenticated', message: 'Devi accedere.' },
        { status: 401 }
      )
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id, status, vendor_name,
        events ( title, date, location, description ),
        stalls ( label )
      `)
      .eq('id', params.id)
      .maybeSingle()

    if (error) {
      safeLogError('[api/ics] fetch error', error)
      return NextResponse.json({ error: 'server_error' }, { status: 500 })
    }
    if (!booking) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    if (booking.status !== 'confirmed') {
      return NextResponse.json(
        { error: 'not_confirmed', message: 'La prenotazione non e\' attiva.' },
        { status: 400 }
      )
    }

    const ev    = booking.events
    const stall = booking.stalls
    if (!ev) return NextResponse.json({ error: 'event_missing' }, { status: 404 })

    const ics = buildIcs({
      uid:         `booking-${booking.id}@mercati-soresina`,
      title:       `Mercato: ${ev.title || 'Soresina'} — Posteggio ${stall?.label || ''}`,
      description: [
        `Prenotazione posteggio ${stall?.label || ''} per "${ev.title}"`,
        booking.vendor_name ? `Intestatario: ${booking.vendor_name}` : '',
        ev.description || '',
      ].filter(Boolean).join('\\n'),
      location:    ev.location || 'Soresina (CR)',
      date:        ev.date, // YYYY-MM-DD
    })

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type':        'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="mercato-soresina-${stall?.label || 'posteggio'}.ics"`,
        'Cache-Control':       'private, no-cache',
      },
    })
  } catch (err) {
    safeLogError('[api/ics] unexpected error', err)
    return NextResponse.json({ error: 'unexpected' }, { status: 500 })
  }
}

// Costruisce un .ics minimale RFC 5545 compliant, all-day event.
// iCalendar richiede:
//   - linee CRLF
//   - escape di , ; \ e newline nei campi testuali
//   - date VALUE=DATE per all-day, con DTEND = giorno successivo
function buildIcs({ uid, title, description, location, date }) {
  const dt     = String(date).replace(/-/g, '')  // YYYYMMDD
  const dtEnd  = shiftDay(dt, 1)
  const stamp  = icsTimestamp(new Date())

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pro Loco Soresina//Mercati Soresina//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dt}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(location)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n') + '\r\n'
}

function icsTimestamp(d) {
  const pad = n => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

function shiftDay(yyyymmdd, deltaDays) {
  const y = Number(yyyymmdd.slice(0, 4))
  const m = Number(yyyymmdd.slice(4, 6))
  const d = Number(yyyymmdd.slice(6, 8))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  const pad = n => String(n).padStart(2, '0')
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`
}

function escapeIcs(s) {
  if (s == null) return ''
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

# Soresina Mercati Case Study

## Context

Soresina Mercati was built for a local market workflow: organizers need to
publish market dates, vendors need to reserve stalls, and the admin team needs
to know who booked what without maintaining a fragile spreadsheet.

The core challenge was operational reliability. A booking app for a local event
does not need complex finance or AI, but it does need to avoid double booking,
protect personal data, remain usable on mobile and provide a simple admin
surface for people who are not developers.

## Users

| User | Goal |
| --- | --- |
| Visitor | See upcoming markets and understand whether stalls are available. |
| Vendor | Register, log in, choose a stall and receive confirmation. |
| Admin | Create events, monitor bookings, export lists and resolve issues. |
| Operator | Keep the system online, backed up and privacy-compliant. |

## Main Workflows

### Vendor booking

1. The vendor opens the event page.
2. The app loads the current stall state from `stalls_with_status`.
3. The vendor chooses a free stall from the grid or satellite view.
4. The booking form is pre-filled from the vendor profile where possible.
5. The API validates the payload and submits the booking through Supabase.
6. Database constraints and RLS prevent invalid ownership or double booking.
7. The vendor lands on a confirmation page and can download the calendar entry.

### Admin management

1. The admin logs in through Supabase Auth.
2. Middleware and RLS protect admin routes and database access.
3. The dashboard shows events, confirmed bookings and operational shortcuts.
4. Admins can create/edit events, print event sheets, export booking CSVs,
   inspect waitlists, run privacy actions and review audit logs.

### Full event fallback

1. If no stall is free, the event page exposes the waitlist widget.
2. Vendors can join or leave the waitlist.
3. The admin dashboard exposes waitlist rows grouped by event.

## Engineering Decisions

### Database-first safety

The UI reacts quickly, but the source of truth is the database. Race conditions
are handled with database constraints and policies, not only with client state.
The booking flow assumes that another user could take the same stall between
page render and submit.

### RLS instead of service-role shortcuts

The app intentionally avoids exposing a Supabase service role key to the web
runtime. Public and vendor actions are routed through anonymous/authenticated
clients; admin actions require an authenticated admin profile and RLS policies.

### Two map modes

The grid view is the resilient default: it is fast, predictable and mobile
friendly. The satellite view gives spatial context when stall positions have
been placed, but it is lazy-loaded so Leaflet does not increase the first load
for users who only need the grid.

### Operational documentation as part of the product

The repository includes deployment, security, GDPR and operations docs because
the app handles personal data and could be managed by a small local team. This
turns the repo into a maintainable project rather than just source code.

## What The Project Demonstrates

- A complete Next.js App Router product with public, vendor and admin surfaces.
- Supabase Auth and Postgres RLS in a real permission model.
- Database constraints for conflict prevention.
- GDPR-aware retention and deletion workflows.
- Admin dashboards with filtering, export and print-oriented views.
- Sentry and Vercel deployment documentation.

## Current Limitations

- The app depends on correct Supabase setup and migrations.
- The free Supabase tier requires manual backup discipline.
- Some admin enrollment operations, such as 2FA setup, are documented as manual
  Supabase Dashboard steps.
- Payment is not integrated; the app focuses on reservation management.

## Future Improvements

- Add a guided first-run setup script for Supabase environments.
- Add automated monthly retention through a scheduled function or GitHub Action.
- Add stronger distributed rate limiting with Redis or Edge Config if traffic
  grows.
- Add payment reconciliation only if the real operational workflow requires it.

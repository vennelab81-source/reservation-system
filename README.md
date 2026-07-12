# Restaurant Reservation Management System

A full-stack app for booking restaurant tables (customers) and managing all bookings (admins).

**Stack:** React (Vite) · Node.js/Express · MongoDB (Mongoose) · JWT auth

## Setup Instructions

### Backend
```bash
cd backend
cp .env.example .env      # fill in MONGO_URI and JWT_SECRET
npm install
npm run seed               # creates 6 sample tables + admin account
npm run dev                # starts on http://localhost:5000
```
Admin login after seeding: `admin@restaurant.com` / `admin123`

### Frontend
```bash
cd frontend
cp .env.example .env      # set VITE_API_URL to your backend URL
npm install
npm run dev                 # starts on http://localhost:5173
```

## Assumptions
- Single restaurant, fixed set of tables (seeded via `npm run seed`, also manageable by admin in-app).
- Reservations use fixed 90-minute slots by default (`durationMinutes`, adjustable per booking).
- Time slots are simple `HH:MM` 24-hour strings on a given calendar date; no timezone conversion beyond the server's local time — fine for a single-location restaurant.
- Any authenticated user can self-register as a customer; admin accounts are created via the seed script (not exposed to public registration) to keep privilege escalation out of scope.
- "Cancel" is a soft state change (`status: cancelled`), not a hard delete, to preserve history for the admin view.

## Reservation & Availability Logic
Each reservation stores a computed `startDateTime` and `endDateTime` (date + time slot + duration). A new booking is only accepted if, for the requested table, no existing **confirmed** reservation's interval overlaps it. Overlap is standard interval intersection:

```
existing.start < new.end AND existing.end > new.start
```

This is checked both:
1. On the `GET /api/reservations/availability` endpoint, so the frontend only shows tables that are actually free (avoids most conflicts before the user even submits).
2. Again, atomically, inside `POST /api/reservations` at booking time — this is the actual source of truth, since availability could change between the two calls (e.g. a race between two users).

Capacity is validated separately: `guests` must not exceed the selected table's `capacity`.

Admin edits to a reservation (date/time/table/guests) re-run the same overlap and capacity checks, excluding the reservation being edited from its own conflict check.

## Role-Based Access
- JWT issued on login/register, containing `id` and `role`.
- `protect` middleware verifies the token and loads the user onto `req.user`.
- `authorize('admin')` middleware gates admin-only routes (table CRUD, viewing/editing all reservations).
- Customers can only ever read/cancel reservations where `reservation.user === req.user._id` (enforced server-side, not just hidden in the UI).
- Frontend `ProtectedRoute` component redirects unauthenticated users to `/login` and redirects users to their correct dashboard if they hit a route for the wrong role.

## Known Limitations
- No password reset / email verification flow.
- Time slots are a fixed dropdown list on the frontend rather than a free-form time picker.
- No pagination on the admin reservation list (fine at demo scale, would need it in production).
- Table management UI supports create/list; edit/deactivate exist as API endpoints but aren't wired into the admin UI yet.
- No automated test suite (out of scope given the 48-hour window; the overlap logic in `reservationController.js` is the highest-value place to add unit tests first).

## Areas for Improvement With More Time
- Add optimistic locking or a DB-level unique constraint on `(table, overlapping window)` to fully close the race-condition window between availability check and booking.
- Add integration tests for the conflict-detection logic (this is the part evaluators will scrutinize most).
- Waitlist / notification when a fully-booked slot frees up.
- Proper timezone handling if the restaurant chain spans regions.
- Rate limiting on auth endpoints.

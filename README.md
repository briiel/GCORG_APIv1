# GCORG_APIv1

Backend API for GC-ORGANIZE. Provides users/auth, events, registrations, attendance, certificates, and in-app notifications.

## Getting Started

1) Install dependencies

```bash
npm install
```

2) Configure environment

Create a .env file in the project root with values similar to:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=gcorganizedb_new
PORT=5000

```

3) Run the server

Development (auto-restart):

```bash
npm run dev
```

Production:

```bash
npm start
```

## Notifications

The API exposes in-app notifications at:

- GET /api/notifications — list notifications for the authenticated user
- PATCH /api/notifications/:id/read — mark a notification as read

Registration success and certificate requests now create notifications instead of sending emails.

## Manual Event Status Updates

Endpoints that can change event status:

- PATCH `/api/event/events/:id/status`
- PUT `/api/event/events/:id` (only if `status` field is provided)

Rule:

- The only manual status change allowed is setting the status to `cancelled`.
- Ownership enforced: only the event creator (organization or OSWS admin) can cancel.

On violation, API returns HTTP 403 with a descriptive message.
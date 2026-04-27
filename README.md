# GC Organize API (GCORG_APIv1)

REST API backend for the **GC Organize** event management system built for Gordon College's Office of Student Welfare and Services (OSWS). Built with Node.js, Express, and MySQL.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Prerequisites](#prerequisites)
3. [Getting Started](#getting-started)
4. [Environment Variables](#environment-variables)
5. [Project Structure](#project-structure)
6. [Architecture Overview](#architecture-overview)
7. [Security Model](#security-model)
8. [Roles & Access Control (RBAC)](#roles--access-control-rbac)
9. [API Reference](#api-reference)
10. [Background Services](#background-services)
11. [NPM Scripts](#npm-scripts)
12. [Error Handling](#error-handling)
13. [Database Notes](#database-notes)
14. [Cloudinary (File Uploads)](#cloudinary-file-uploads)
15. [Common Issues](#common-issues)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 4 |
| Database | MySQL (via `mysql2`) |
| Auth | JWT (`jsonwebtoken`) |
| Password Hashing | `bcrypt` |
| Image Processing | `sharp`, `canvas` |
| Cloud Storage | Cloudinary |
| QR Codes | `qrcode` |
| Email | Nodemailer (via `mailer.js`) |
| Scheduling | `node-cron` |
| PDF | `pdfkit`, `pdf2pic` |
| Dev Server | `nodemon` |

---

## Prerequisites

- **Node.js** v18 or higher
- **MySQL** 5.7+ or MariaDB 10.4+ (XAMPP ships with MariaDB)
- A **Cloudinary** account (free tier works)
- An **RSA-2048 key pair** (for transport encryption — see below)

---

## Getting Started

```bash
# 1. Clone the repository and navigate to the API folder
cd GCORG_APIv1

# 2. Install dependencies
# PowerShell users: if npm is blocked, either run:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# or use the batch file version:
npm.cmd install

# 3. Copy the environment template and fill in your values
copy .env.example .env

# 4. Start the development server
npm run dev
```

The server will start on `http://localhost:8080` by default.

Health check: `GET http://localhost:8080/health`

---

## Environment Variables

Copy `.env.example` to `.env` and populate every field. The server **will refuse to start** if any required variable is missing.

```env
# ── Server ─────────────────────────────────────────────
PORT=8080
NODE_ENV=development          # or "production"

# ── Database ───────────────────────────────────────────
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=gcorganizedb_new
DB_SSL=false                  # set to "true" for remote/cloud DBs

# ── Timezone (optional) ────────────────────────────────
EVENT_TZ_OFFSET=+08:00
SERVER_TZ_OFFSET=+08:00
DB_SET_SESSION_TZ=false       # forces SET time_zone on each connection
DB_SET_DRIVER_TZ=false        # applies mysql2 driver-level timezone

# ── Security ───────────────────────────────────────────
JWT_SECRET=<64+ character random string>
CRON_JOB_SECRET=<random secret for cron webhook>
ENCRYPTION_KEY=<64 hex characters = 32 bytes>

# ── RSA Key Pair (transport encryption) ────────────────
RSA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# ── Cloudinary ─────────────────────────────────────────
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
```

### Required vs Optional

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | ✅ | Min 64 chars recommended |
| `DB_HOST`, `DB_USER`, `DB_NAME` | ✅ | |
| `CRON_JOB_SECRET` | ✅ | Used to authenticate the cron webhook |
| `ENCRYPTION_KEY` | ✅ | **Must be exactly 64 hex characters** |
| `RSA_PRIVATE_KEY` | ✅ | Used for transport encryption |
| `CLOUDINARY_URL` | ⚠️ | Required for image/certificate uploads in production; falls back to base64 data URLs in dev |
| `PORT` | ❌ | Defaults to `8080` |
| `DB_SSL` | ❌ | Defaults to `false` |

### Generating Keys

```bash
# Generate ENCRYPTION_KEY (64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate RSA key pair (PowerShell / Git Bash)
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

The **public key** goes into the Angular frontend's `environment.ts`. The **private key** goes into `RSA_PRIVATE_KEY` in your `.env`.

---

## Project Structure

```
GCORG_APIv1/
├── src/
│   ├── server.js              # App entry point, middleware setup
│   ├── assets/                # Certificate template images & layout JSON
│   ├── config/
│   │   ├── db.js              # MySQL2 promise pool with auto-retry
│   │   └── env-validator.js   # Validates required env vars on startup
│   ├── controllers/           # Route handler functions
│   ├── middleware/
│   │   ├── authMiddleware.js        # JWT verification → req.user
│   │   ├── checkRole.js             # RBAC role-checking factory
│   │   ├── blockDirectBrowserAccess.js  # Blocks browser navigation to /api/*
│   │   ├── transportEncryption.js   # Hybrid RSA+AES-256-GCM wire encryption
│   │   ├── uploadMiddleware.js      # Multer (memory) + sharp → Cloudinary
│   │   ├── rateLimit.js             # Custom per-route rate limiter
│   │   └── secureResponse.js        # Security response headers
│   ├── models/                # Raw SQL query functions (data layer)
│   ├── routes/                # Express routers
│   ├── scripts/               # One-off utility scripts
│   ├── services/              # Business logic layer
│   └── utils/
│       ├── certificateGenerator.js  # Canvas-based e-cert PNG generator
│       ├── dbDate.js                # Timezone-safe date helpers
│       ├── dbRetry.js               # Exponential-backoff retry wrapper
│       ├── encryption.js            # AES-256-GCM field-level encryption
│       ├── error-classes.js         # Custom error classes
│       ├── error-logger.js          # Structured error logging
│       ├── mailer.js                # Nodemailer email sender
│       └── errorHandler.js         # Global Express error handler
├── migrations/                # SQL migration scripts (run manually)
├── scripts/                   # Seed/utility scripts
├── .env                       # Local secrets (never commit)
├── .env.example               # Template for new developers
└── package.json
```

---

## Architecture Overview

```
Request
  │
  ├─► blockDirectBrowserAccess  (silently kills browser navigation to /api/*)
  ├─► helmet / securityHeaders  (HTTP security headers)
  ├─► compression               (gzip responses)
  ├─► globalLimiter             (200 req/min per IP on /api/*)
  ├─► cors
  ├─► express.json
  ├─► decryptRequestBody        (RSA→AES-GCM unwrap of incoming payload)
  ├─► encryptResponseBody       (AES-GCM wrap of all outgoing JSON)
  │
  ├─► Routes → Controllers → Services → Models → MySQL
  │
  └─► Global error handler
```

### Request/Response Encryption (Transport Layer)

All `/api/*` traffic uses a **Hybrid RSA-2048 + AES-256-GCM** scheme:

1. The Angular frontend generates a single-use AES-256 key per request.
2. It encrypts that key with the backend's **RSA public key** and sends it in the `X-Session-Key` header.
3. The backend decrypts `X-Session-Key` using its **RSA private key** (`RSA_PRIVATE_KEY`).
4. Encrypted request bodies are flagged with `X-Encrypted: true`.
5. All JSON responses are AES-GCM encrypted using the same session key.

> **Dev note:** If `X-Session-Key` is absent, the endpoint returns `400 Missing X-Session-Key header`. This means plain `curl` or Postman requests need to include this header.

---

## Security Model

| Feature | Implementation |
|---|---|
| Authentication | JWT Bearer tokens (`Authorization: Bearer <token>`) |
| Password storage | `bcrypt` (cost factor 10) |
| PII field encryption | AES-256-GCM via `utils/encryption.js` — `iv:authTag:ciphertext` format stored in DB |
| Wire encryption | Hybrid RSA-2048 + AES-256-GCM (every `/api/*` request) |
| Rate limiting | Custom per-route limits (see each route file) |
| Browser blocking | Direct browser navigation to `/api/*` silently destroys the TCP socket |
| Security headers | `helmet` + custom `secureResponse` middleware |

---

## Roles & Access Control (RBAC)

Three roles exist in the system:

| Role | Token value | Description |
|---|---|---|
| **Student** | `student` | Regular user, can register for events |
| **OrgOfficer** | `orgofficer` | Member of a student organization, can create org events |
| **OSWSAdmin** | `oswsadmin` | OSWS staff, full admin access |

### How roles are enforced

1. **`authMiddleware.js`** — Verifies the JWT and attaches `req.user` (includes `roles[]`).
2. **`checkRole(allowedRoles[])`** — Middleware factory that checks if `req.user.roles` intersects `allowedRoles`.
   - For `OrgOfficer`, it performs a **live DB check** against `organization_members` to prevent stale-token abuse.

### Role elevation flow

Students submit a role request → OSWSAdmin approves → student becomes OrgOfficer in a specific organization.

---

## API Reference

All routes are prefixed with `/api` unless otherwise noted. All protected routes require:
```
Authorization: Bearer <jwt>
X-Session-Key: <rsa-encrypted-aes-key-base64>
```

---

### Authentication — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register a new student account |
| `POST` | `/api/auth/login` | Public | Login, returns JWT with roles |
| `POST` | `/api/auth/verify` | Protected | Verify JWT validity |
| `POST` | `/api/auth/accept-privacy-policy` | Protected | Record privacy policy acceptance |
| `GET` | `/api/auth/privacy-policy-status` | Protected | Get policy acceptance status |

**Rate limit:** 10 requests per 15 minutes on all auth endpoints.

---

### Users — `/api`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users` | Protected | List all users |
| `GET` | `/api/users/:id` | Protected | Get user by ID |
| `GET` | `/api/users/organization/:orgId/members` | Protected | Get org members |
| `DELETE` | `/api/users/organization/:orgId/members/:memberId` | Protected | Remove org member |
| `POST` | `/api/users/fetch/:resource` | Protected | Fetch dispatcher (`user_by_id`, `org_members`) |

---

### Events — `/api/event`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/event/events` | Protected | Create a new event (with optional poster upload) |
| `GET` | `/api/event/events` | Protected | List all events |
| `GET` | `/api/event/events/:id` | Public | Get event by ID |
| `PUT` | `/api/event/events/:id` | Protected | Update an event |
| `DELETE` | `/api/event/events/:id` | Protected | Soft-delete (trash) an event |
| `POST` | `/api/event/events/:id/restore` | Protected | Restore a trashed event |
| `DELETE` | `/api/event/events/:id/permanent` | Protected | Permanently delete a trashed event |
| `PATCH` | `/api/event/events/:id/status` | Protected | Update event status manually |
| `POST` | `/api/event/events/register` | Protected | Register a student for an event |
| `POST` | `/api/event/events/attendance` | Protected | Mark attendance |
| `POST` | `/api/event/events/trash-multiple` | Protected | Bulk soft-delete events |
| `GET` | `/api/event/events/trash` | Protected | List trashed events |
| `GET` | `/api/event/events/organizations` | Public | All org-created events |
| `GET` | `/api/event/events/osws` | Public | All OSWS-created events |
| `GET` | `/api/event/events/admin/:admin_id` | OSWSAdmin | Events by admin |
| `GET` | `/api/event/events/creator/:creator_id` | Protected | Events by creator/org |
| `GET` | `/api/event/participants/:student_id/events` | Protected | Events a student registered for |
| `GET` | `/api/event/students/:student_id/attended` | Protected | Events a student attended |
| `GET` | `/api/event/attendance-records` | Protected | All attendance records |
| `GET` | `/api/event/attendance-records/event/:eventId` | Protected | Records for a specific event |
| `GET` | `/api/event/certificates` | Protected | Certificates for a student |
| `POST` | `/api/event/events/:id/request-certificate` | Protected | Request a certificate |
| `POST` | `/api/event/registrations/:registration_id/approve` | Protected | Approve a registration |
| `POST` | `/api/event/registrations/:registration_id/reject` | Protected | Reject a registration |
| `GET` | `/api/event/:event_id/participants` | Protected | List event participants |
| `GET` | `/api/event/stats/organization` | Protected | Org dashboard stats |
| `GET` | `/api/event/stats/osws` | Protected | OSWS dashboard stats |
| `GET` | `/api/event/stats/osws/charts` | Protected | OSWS dashboard chart data |
| `POST` | `/api/event/fetch/:resource` | Protected | Generic fetch dispatcher |

**Event poster uploads** use `multipart/form-data` with field name `event_poster`. Images are converted to WebP by `sharp` and uploaded to Cloudinary.

---

### Evaluations — `/api`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/events/:event_id/evaluations` | Protected | Submit evaluation (student) |
| `GET` | `/api/events/:event_id/evaluations` | Protected | Get all evaluations (organizer/admin) |
| `GET` | `/api/events/:event_id/evaluations/status` | Protected | Evaluation status for current student |
| `GET` | `/api/events/:event_id/evaluations/me` | Protected | Student's own submitted evaluation |
| `GET` | `/api/events/:event_id/evaluations/raw` | Protected | Raw evaluation rows (debug) |

Submitting an evaluation for an **OSWS event** automatically generates a certificate and uploads it to Cloudinary. **Org events** require a manual certificate request by the organizer.

---

### Certificates — `/api/certificates`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/certificates/requests` | Protected | Get certificate requests for an org |
| `POST` | `/api/certificates/fetch/:resource` | Protected | Fetch dispatcher |
| `POST` | `/api/certificates/requests/:id/approve` | Protected | Approve a certificate request |
| `POST` | `/api/certificates/requests/:id/reject` | Protected | Reject a certificate request |
| `PATCH` | `/api/certificates/requests/:id/status` | Protected | Update status (`pending`/`processing`/`sent`) |

---

### Admin — `/api`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/manage-users` | OSWSAdmin | List all users for management |
| `POST` | `/api/admin/fetch/:resource` | OSWSAdmin | Fetch dispatcher |
| `POST` | `/api/admins` | OSWSAdmin | Add a new admin |
| `DELETE` | `/api/admins/:id` | OSWSAdmin | Remove an admin |

---

### Role Requests — `/api`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/organizations` | Protected | List all organizations |
| `POST` | `/api/roles/request` | Student | Submit a role upgrade request |
| `GET` | `/api/roles/my-requests` | Protected | Current user's requests |
| `POST` | `/api/roles/fetch/:resource` | Protected | Fetch dispatcher |
| `GET` | `/api/admin/requests` | OSWSAdmin | All role requests |
| `GET` | `/api/admin/requests/pending` | OSWSAdmin | Pending role requests |
| `POST` | `/api/admin/approve/:requestId` | OSWSAdmin | Approve a role request |
| `POST` | `/api/admin/reject/:requestId` | OSWSAdmin | Reject a role request |

**Rate limit on submissions:** 5 requests per 15 minutes.

---

### Notifications — `/api/notifications`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/notifications/fetch/:resource` | Protected | Get notifications |
| `POST` | `/api/notifications/read-all` | Protected | Mark all notifications as read |
| `PATCH` | `/api/notifications/:id/read` | Protected | Mark single notification as read |

---

### Archive / Trash — `/api`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/archive/trash` | Protected | List all trashed items |
| `POST` | `/api/archive/fetch/:resource` | Protected | Fetch dispatcher |
| `POST` | `/api/archive/admins/:id/restore` | Protected | Restore a trashed admin |
| `POST` | `/api/archive/organizations/:id/restore` | Protected | Restore a trashed organization |
| `POST` | `/api/archive/members/:id/restore` | Protected | Restore a trashed member |
| `DELETE` | `/api/archive/admins/:id` | Protected | Permanently delete an admin |
| `DELETE` | `/api/archive/organizations/:id` | Protected | Permanently delete an organization |
| `DELETE` | `/api/archive/members/:id` | Protected | Permanently delete a member |
| `GET` | `/api/archive/expired-count` | Protected | Count items eligible for auto-deletion |
| `POST` | `/api/archive/cleanup` | Protected | Manually trigger cleanup |

---

### Metrics — `/api/metrics`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/metrics/visits` | **Public** | Get total site visit count |
| `POST` | `/api/metrics/visits` | **Public** | Increment site visit count |

The `site_visits` table is created automatically on first access.

---

### Health & Cron Webhook

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | Public | Basic alive check |
| `GET` | `/health` | Public | Detailed health check with uptime |
| `POST` | `/api/cron/run-status-updates` | `CRON_JOB_SECRET` | Trigger event status auto-update |

The cron webhook authenticates with `Authorization: Bearer <CRON_JOB_SECRET>` (not a JWT). Use this with an external scheduler (e.g., cron-job.org) to keep event statuses up to date in production.

---

## Background Services

### Auto-Status Updates

In **development**, the server polls `eventService.autoUpdateEventStatuses()` every **60 seconds** via `setInterval`. This transitions events between `not_yet_started` → `ongoing` → `concluded` based on their dates.

In **production**, this is disabled in favor of the external cron webhook at `POST /api/cron/run-status-updates`.

### Auto-Cleanup Service

A `node-cron` job runs daily at **2:00 AM Asia/Manila** and permanently deletes items that have been in the trash for **more than 30 days**. Items affected: admins, organizations, members, events.

Configured in `src/services/autoCleanupService.js`.

---

## NPM Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with `nodemon` (auto-restart on file changes) |
| `npm start` | Start production server (`node src/server.js`) |
| `npm run cert:sample` | Generate a sample certificate PNG to verify canvas/fonts |
| `npm run reminders:run` | Run reminder sweep manually |
| `npm run seed:notifications` | Seed notification data |
| `npm run add:dummy` | Add a dummy notification for testing |

---

## Error Handling

All errors flow through the global error handler in `server.js`. It handles:

| Error Type | HTTP Status |
|---|---|
| `JsonWebTokenError` | 401 |
| `TokenExpiredError` | 401 |
| `ER_DUP_ENTRY` (MySQL) | 409 |
| `ER_NO_REFERENCED_ROW_2` | 400 |
| `ECONNREFUSED` / `PROTOCOL_CONNECTION_LOST` | 503 |
| `ValidationError` | 400 |
| `LIMIT_FILE_SIZE` (Multer) | 400 |
| Uncaught | 500 |

In **production**, 5xx error messages are replaced with a generic `"Internal server error"` to prevent leaking stack traces.

---

## Database Notes

### Connection Pool

- **Pool size:** 5 connections max
- **Idle timeout:** 30 seconds
- **Auto-retry:** Transient errors (`ECONNRESET`, `ETIMEDOUT`, etc.) are retried up to 3 times with exponential backoff (up to 10 seconds).

### Migrations

SQL migration scripts are in the `/migrations` directory. They must be **run manually** against the database in order. There is no automated migration runner — execute them in your MySQL client (e.g., phpMyAdmin, MySQL Workbench, or the CLI).

### Field-Level Encryption

Sensitive PII columns (e.g., student names) are encrypted with AES-256-GCM before being stored in the database. The encryption format is `base64(iv):base64(authTag):base64(ciphertext)`. The key is `ENCRYPTION_KEY` from your `.env`.

> **Important:** Changing `ENCRYPTION_KEY` after data has been written will make all existing encrypted records unreadable.

---

## Cloudinary (File Uploads)

Image uploads (event posters, proof of payments) use **in-memory processing**:
1. `multer` accepts the file into RAM (`memoryStorage`).
2. `sharp` converts it to WebP at 80% quality.
3. The WebP buffer is streamed to Cloudinary.

Cloudinary folders used:
- `event-posters/` — event poster images
- `proof-of-payments/` — payment proof images
- `certificates/` — generated certificate PNGs

If `CLOUDINARY_URL` is not set, image uploads fall back to **base64 data URLs** stored in the database (development only — not suitable for production).

---

## Common Issues

### `npm install` fails in PowerShell
```powershell
# Fix execution policy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# Or use the .cmd variant
npm.cmd install
```

### `Missing required environment variables`
The server checks for `JWT_SECRET`, `DB_HOST`, `DB_USER`, `DB_NAME`, `CRON_JOB_SECRET`, and `ENCRYPTION_KEY` on startup. Copy `.env.example` → `.env` and fill all values.

### `ENCRYPTION_KEY must be a 64-character hexadecimal string`
Generate a valid key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend gets `ERR_CONNECTION_REFUSED` on port 5000
The port was changed to **8080**. Update your Angular `environment.ts`:
```ts
apiUrl: `http://${window.location.hostname}:8080/api`
```

### `400 Missing X-Session-Key header` in Postman
Every `/api/*` request requires the `X-Session-Key` header containing an RSA-encrypted AES session key. When testing directly, either use the Angular frontend or implement the transport encryption flow in your test client.

### Canvas / Certificate generation fails
The certificate generator downloads Google Fonts (Lora, Great Vibes) to the OS temp directory on first run. Ensure the server has internet access. Set `USE_REMOTE_FONTS=false` to skip and use system fonts instead.
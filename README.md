# Hercules — Law Firm Case Management Platform

A full-stack web application for law firms to manage cases, track collections, and schedule work using AI assistance.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.25, Fiber v2, GORM, PostgreSQL |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Auth | Google OAuth 2.0 (One-Tap login + Calendar linking) |
| AI | Google Gemini 2.5 Flash |
| JWT | `golang-jwt/jwt/v5` (HMAC-SHA256) |

---

## Project Structure

```
Hercules/
├── backend/
│   ├── cmd/
│   │   ├── api/          # Main server entry point
│   │   └── seed/         # Database seeding utility
│   ├── internal/
│   │   ├── auth/         # JWT sign/verify utilities
│   │   ├── adapter/
│   │   │   ├── database/ # PostgreSQL connection
│   │   │   └── repository/ # GORM repository implementation
│   │   ├── core/
│   │   │   ├── model/    # Domain models (Account, User, Case, ...)
│   │   │   ├── repository/ # Repository interface
│   │   │   └── service/  # Business logic (scoring)
│   │   └── transport/
│   │       └── http/     # Fiber HTTP handlers
│   └── schema.sql        # Database schema reference
└── frontend/
    └── src/
        ├── api.ts         # Backend API client
        ├── types/         # TypeScript type definitions
        ├── context/       # React context (theme)
        ├── components/    # Shared components
        └── pages/         # Route pages
```

---

## Environment Variables

Create `backend/.env` (never commit this file):

```env
# Google OAuth — from Google Cloud Console
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# JWT signing secret — generate with: openssl rand -base64 32
JWT_SECRET=your-random-secret-here

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# PostgreSQL connection string
DATABASE_URL=host=localhost user=postgres password=password dbname=hercules port=5432 sslmode=disable
```

---

## First-Time Setup

### 1. Prerequisites

- Go 1.21+
- Node.js 18+
- PostgreSQL 14+

### 2. Create the database

```sql
CREATE DATABASE hercules;
```

The schema is applied automatically by AutoMigrate when the server starts. The `schema.sql` file is for reference only.

### 3. Configure Google OAuth

In [Google Cloud Console](https://console.cloud.google.com/):

1. Create an OAuth 2.0 Client ID (Web Application)
2. Add these **Authorized JavaScript Origins**:
   - `http://localhost:5173`
   - `http://localhost:8080`
3. Add these **Authorized Redirect URIs**:
   - `http://localhost:5173/auth/google/callback`
4. Copy the Client ID and Secret into your `.env`

### 4. Seed the database (required before first login)

The seed command creates the firm account and the admin user. Run it **before** the admin logs in for the first time:

```bash
cd backend
go run ./cmd/seed -email admin@perniklaw.com
```

**Options:**

| Flag | Default | Description |
|---|---|---|
| `-email` | `lior@perniklaw.com` | Admin user email to create |
| `-reset` | `false` | Delete all mock cases and re-seed them |

**Example — reset mock cases:**
```bash
go run ./cmd/seed -email admin@perniklaw.com -reset
```

### 5. Start the backend

```bash
cd backend
go run ./cmd/api
# Server starts on http://localhost:8080
```

### 6. Start the frontend

```bash
cd frontend
npm install
npm run dev
# App starts on http://localhost:5173
```

---

## Authentication Flow

### Login (daily use)

1. Navigate to `http://localhost:5173/login`
2. Click **Sign in with Google** (One-Tap or popup)
3. The Google ID token is sent to the backend and **verified cryptographically** against Google's public keys
4. A signed JWT is returned and stored in `localStorage`
5. All subsequent API requests use `Authorization: Bearer <jwt>`
6. Sessions auto-expire after **24 hours** (JWT expiry) and auto-logout after **15 minutes of inactivity**

### Google Calendar linking (one-time per user)

Connecting Google Calendar allows the AI scheduler to see your existing events and create new ones.

1. Go to **Settings → Profile**
2. Click **Connect Google Calendar**
3. Authorize the calendar permission in the Google consent screen
4. You are redirected back to the dashboard — the calendar is now linked

### Roles

| Role | Capabilities |
|---|---|
| `admin` | Full access: manage users, view all cases, change roles |
| `lawyer` | View and manage cases assigned to their account, personal tasks, AI chat |

**The first admin must be created via the seed command.** After that, any admin can promote lawyers using Settings → Admin → User Management.

---

## Adding a New Lawyer

New lawyers join automatically — no manual setup needed:

1. The lawyer navigates to `http://localhost:5173/login`
2. They sign in with their `@perniklaw.com` Google Workspace account
3. The backend looks up the account by email domain (`perniklaw.com`) and auto-creates the user with role `lawyer`
4. An admin can go to **Settings → Admin** to update their role, seniority, or other profile fields

---

## Adding a New Firm (future multi-tenancy)

There is no UI for this yet. To onboard a second firm, extend the seed command with the new firm's details and run it against the same database, or update the `accounts` table directly in Postgres.

```sql
INSERT INTO accounts (name, domain) VALUES ('New Firm Name', 'newfirm.com');
```

Then run:
```bash
go run ./cmd/seed -email admin@newfirm.com
```

---

## Key Features

### Case Management (`/dashboard`)
- View all firm cases sorted by priority score
- Create, edit, and filter cases
- Import cases from Excel (`.xlsx`) — supports header-based column detection and attorney name/initials matching
- Export all cases to Excel

### AI Assistant — Hercules (`/hercules`)
- Answers questions about your assigned cases
- Proposes a weekly work schedule based on case priorities, court dates, and calendar availability
- Can create calendar events directly in Google Calendar
- Creates custom scoring rules on request

### AI Assistant — Moneta (`/moneta`)
- Collections-focused AI using the Voss negotiation methodology
- Generates scripts and strategies for following up on outstanding balances
- Analyzes client payment status and recommends next actions

### Personal Tasks (`/tasks`)
- Create personal to-do items with estimated durations
- The Hercules AI sees your pending tasks and can suggest scheduling them into your week

### Settings (`/settings`)
- Update profile: name, location, seniority level
- Connect/manage Google Calendar
- Admin tab: view all users, update roles (admin only)

---

## Priority Scoring

Every case has a `priority_score` (integer, baseline 50). Scores are recalculated automatically whenever a case is created or updated, using:

1. **Baseline rules** (hardcoded in `scoring_service.go`):
   - `+10` for `status = new`
   - `+20` for title containing "urgent"

2. **Custom rules** — admins can ask Hercules to create new rules, e.g.:
   > "Add a rule: if balance due is over $5000, add 30 points"

Rules support fields: `title`, `status`, `days_open`, `payment_status`
Operators: `eq`, `ne`, `contains`, `gt`, `lt`, `gte`, `lte`

---

## API Endpoints

### Public
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login with Google ID token |
| `GET` | `/auth/google/login` | Initiate Google Calendar OAuth |
| `GET` | `/auth/google/callback` | Google OAuth callback |
| `GET` | `/health` | Health check |

### Authenticated (requires `Authorization: Bearer <jwt>`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/cases` | List all cases for the user's firm |
| `POST` | `/api/cases` | Create a case |
| `PUT` | `/api/cases/:id` | Update a case |
| `POST` | `/api/cases/import` | Import cases from Excel file |
| `GET` | `/api/cases/export` | Export cases as Excel download |
| `GET` | `/api/tasks` | List personal tasks |
| `POST` | `/api/tasks` | Create a task |
| `PUT` | `/api/tasks/:id` | Update a task |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `GET` | `/api/users/me` | Get current user profile |
| `GET` | `/api/users` | List all users in firm (admin only) |
| `PUT` | `/api/users/:id/role` | Update user role (admin only) |
| `PUT` | `/api/users/:id/profile` | Update user profile (self or admin) |
| `POST` | `/api/ai/chat` | Send message to Hercules or Moneta AI |
| `POST` | `/api/calendar/sync-schedule` | Push AI-proposed events to Google Calendar |

---

## Known Limitations (not yet implemented)

- Google OAuth tokens are stored in plaintext in the database — should be encrypted at rest before production
- No rate limiting on the API
- The dev-mode fallback in `Login` (accepting a plain email with no ID token) must be removed before production deployment
- No email-based invite system — users must use a matching Google Workspace domain to auto-join

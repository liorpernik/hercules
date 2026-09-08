# Hercules — Law Firm Operations Platform

A full-stack web application for law firms to manage cases, track collections, and schedule attorney work with AI assistance.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Go 1.25, Fiber v2, GORM, PostgreSQL |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS |
| **Authentication** | Google OAuth 2.0 (One-Tap & Consent Flow), JWT (`golang-jwt/jwt/v5`) |
| **AI & External APIs** | Google Gemini 2.5 Flash, Google Calendar API v3 |
| **Data Processing** | Excelize (`qax-os/excelize/v2`) |

---

## Project Structure

```
Hercules/
├── backend/
│   ├── cmd/
│   │   ├── api/             # HTTP server entrypoint
│   │   └── seed/            # Database initialization utility
│   ├── internal/
│   │   ├── auth/            # JWT issuance & claim verification
│   │   ├── adapter/
│   │   │   ├── database/    # PostgreSQL connection lifecycle
│   │   │   ├── repository/  # GORM repository implementation
│   │   │   └── google_calendar.go # Google Calendar API adapter
│   │   ├── core/
│   │   │   ├── model/       # Domain entities (Account, User, Case, Rule, Task)
│   │   │   ├── repository/  # Repository contracts (interfaces)
│   │   │   └── service/     # Case prioritization & scoring logic
│   │   └── transport/
│   │       └── http/        # Fiber REST handlers & routing
│   └── schema.sql           # Database schema reference
└── frontend/
    └── src/
        ├── api.ts            # Type-safe API client
        ├── types/            # TypeScript domain interfaces
        ├── context/          # Global application state (Theme, Auth)
        ├── components/       # Reusable UI components (Scheduler, AutoLogout)
        └── pages/            # View routes (Dashboard, Hercules, Moneta, Tasks, Settings)
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Google OAuth 2.0 (Google Cloud Console)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# JWT Signing Key — generate with: openssl rand -base64 32
JWT_SECRET=your-random-secret-here

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# PostgreSQL Connection String
DATABASE_URL=host=localhost user=postgres password=your-postgres-password dbname=hercules port=5432 sslmode=disable
```

### Frontend (`frontend/.env`)

```env
# Google OAuth Client ID (must match backend GOOGLE_CLIENT_ID)
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

---

## Getting Started

### 1. Prerequisites
- **Go** 1.21+
- **Node.js** 18+
- **PostgreSQL** 14+

### 2. Database Setup
Create the PostgreSQL database (tables are auto-migrated on backend startup):
```sql
CREATE DATABASE hercules;
```

### 3. Google OAuth Configuration
In [Google Cloud Console](https://console.cloud.google.com/):
1. Create an **OAuth 2.0 Client ID** (Web Application).
2. Set **Authorized JavaScript Origins**: `http://localhost:5173`, `http://localhost:8080`.
3. Set **Authorized Redirect URIs**: `http://localhost:5173/auth/google/callback`.
4. Copy the credentials into `backend/.env` and `frontend/.env`.

### 4. Initialize Firm & Admin Account
Initialize the database with your organization and first administrator:
```bash
cd backend
go run ./cmd/seed -email admin@yourfirm.com
```

Options:
| Flag | Default | Description |
|---|---|---|
| `-email` | `""` | Admin email address (required) |
| `-reset` | `false` | Wipe all existing cases for the firm |

### 5. Launch the Services

**Backend Server:**
```bash
cd backend
go run ./cmd/api
# REST API running on http://localhost:8080
```

**Frontend Application:**
```bash
cd frontend
npm install
npm run dev
# Web application running on http://localhost:5173
```

---

## Architecture & Authentication Flow

### JIT User Provisioning & Session Lifecycle
1. Users authenticate via Google One-Tap / OAuth consent.
2. The backend cryptographically validates the Google ID token against Google's certs.
3. The user's email domain is checked against registered firm accounts:
   - Existing firm: user is automatically provisioned with the `lawyer` role.
   - Tenant isolation is strictly enforced on all subsequent queries using `account_id`.
4. A signed JWT is returned for session authorization (`Authorization: Bearer <jwt>`).
5. Inactivity detection logs out idle sessions after 15 minutes.

### Calendar Integration
Users can optionally link Google Calendar via OAuth2 authorization code grant, granting Hercules permission to read free/busy schedules and write scheduled blocks directly to their calendar.

---

## Core Capabilities

### Case Operations (`/dashboard`)
- Real-time case tracking with dynamic priority ranking.
- Advanced filtering: Active vs. Closed cases, My Cases vs. Team Cases, Attorney-specific drilldown.
- Batch import/export with XLSX spreadsheet parsing.

### AI Scheduling & Matter Synthesis — Hercules (`/hercules`)
- Natural-language queries over matter status and deadlines.
- Algorithmic schedule proposal that balances court appearances, urgency scores, and open calendar slots.
- One-click synchronization of proposed schedules into Google Calendar.

### Collections Negotiation Assistant — Moneta (`/moneta`)
- Financial receivables overview with balance and past-due tracking.
- AI negotiation partner leveraging tactical empathy and calibrated questions to compose follow-up outreach.

### Personal Task Management (`/tasks`)
- Granular task backlog linked to lawyer matters with duration estimations used by Hercules for scheduling.

---

## Priority Scoring Specification

Every case computes a composite `priority_score` (default: 50 points):
- **Baseline Rules**:
  - `+10 points` for `status == "new"`
  - `+20 points` for matters marked with `"urgent"` in the title
- **Dynamic Rules**:
  - Admins can define custom scoring logic via natural language or direct configuration:
    ```json
    { "field": "balance_due", "operator": "gt", "value": "5000", "points": 30 }
    ```
  - Supported operators: `eq`, `ne`, `contains`, `gt`, `lt`, `gte`, `lte`.

---

## API Summary

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Google ID token verification & JWT issuance |
| `GET` | `/auth/google/login` | Public | Google Calendar OAuth authorization entrypoint |
| `GET` | `/auth/google/callback`| Public | Calendar OAuth exchange callback |
| `GET` | `/health` | Public | Service health probe |
| `GET` | `/api/cases` | Authenticated | List tenant-scoped cases |
| `POST` | `/api/cases` | Authenticated | Create matter |
| `PUT` | `/api/cases/:id` | Authenticated | Update matter metadata |
| `POST` | `/api/cases/import` | Authenticated | Batch Excel matter import |
| `GET` | `/api/cases/export` | Authenticated | Export matters as Excel spreadsheet |
| `GET` | `/api/tasks` | Authenticated | List personal attorney tasks |
| `POST` | `/api/tasks` | Authenticated | Create personal task |
| `GET` | `/api/users/me` | Authenticated | Current authenticated user profile |
| `GET` | `/api/users` | Admin | List organization users |
| `PUT` | `/api/users/:id/role`| Admin | Role management (lawyer/partner/admin) |
| `POST` | `/api/ai/chat` | Authenticated | Hercules & Moneta conversational interface |
| `POST` | `/api/calendar/sync-schedule` | Authenticated | Batch commit schedule to Google Calendar |

---

## Roadmap & Planned Enhancements

- **Token Encryption at Rest**: Encrypt third-party Google OAuth tokens stored in PostgreSQL using AES-256.
- **API Rate Limiting**: Add rate-limiting middleware to protect the AI chat and authentication endpoints from abuse.
- **Email Invitation System**: Add an invitation workflow allowing firm administrators to onboard team members via email links.

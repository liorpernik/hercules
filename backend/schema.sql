-- Hercules Database Schema
-- Note: AutoMigrate is used at runtime. This file is for reference only.
-- Run migrations by starting the API server which calls AutoMigrate automatically.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Accounts (Law Firms)
CREATE TABLE accounts (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       TEXT NOT NULL,
    domain     TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Users (Lawyers / Admins)
CREATE TABLE users (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id           UUID REFERENCES accounts(id) ON DELETE CASCADE,
    email                TEXT NOT NULL UNIQUE,
    full_name            TEXT NOT NULL DEFAULT '',
    role                 TEXT NOT NULL DEFAULT 'lawyer',
    auth_provider        TEXT NOT NULL DEFAULT 'google',
    sso_attributes       JSONB DEFAULT '{}',
    custom_attributes    JSONB DEFAULT '{}',
    location             TEXT NOT NULL DEFAULT '',
    seniority_level      TEXT NOT NULL DEFAULT '',
    google_access_token  TEXT NOT NULL DEFAULT '',
    google_refresh_token TEXT NOT NULL DEFAULT '',
    google_token_expiry  TIMESTAMP WITH TIME ZONE,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at           TIMESTAMP WITH TIME ZONE
);

-- Cases
CREATE TABLE cases (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id          UUID REFERENCES accounts(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'new',
    source              TEXT NOT NULL DEFAULT 'manual',
    assigned_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    priority_score      INTEGER NOT NULL DEFAULT 0,
    phase               TEXT NOT NULL DEFAULT '',
    charges             TEXT NOT NULL DEFAULT '',
    last_hearing        TEXT NOT NULL DEFAULT '',
    next_court_date     TEXT NOT NULL DEFAULT '',
    jurisdiction        TEXT NOT NULL DEFAULT '',
    pending_actions     TEXT NOT NULL DEFAULT '',
    jail_visit          BOOLEAN NOT NULL DEFAULT FALSE,
    client_profile      TEXT NOT NULL DEFAULT '',
    last_interaction    TEXT NOT NULL DEFAULT '',
    balance_due         NUMERIC(12,2) NOT NULL DEFAULT 0,
    current_or_past_due TEXT NOT NULL DEFAULT '',
    last_payment_date   TIMESTAMP WITH TIME ZONE,
    last_payment_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    past_due_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    lead_attorney       TEXT NOT NULL DEFAULT '',
    ext_data            JSONB DEFAULT '{}',
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at          TIMESTAMP WITH TIME ZONE
);

-- Scoring Rules
CREATE TABLE scoring_rules (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id   UUID REFERENCES accounts(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    condition    JSONB NOT NULL,
    score_effect INTEGER NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at   TIMESTAMP WITH TIME ZONE
);

-- Personal Tasks
CREATE TABLE personal_tasks (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID REFERENCES users(id) ON DELETE CASCADE,
    title              TEXT NOT NULL,
    description        TEXT NOT NULL DEFAULT '',
    status             TEXT NOT NULL DEFAULT 'pending',
    estimated_duration TEXT NOT NULL DEFAULT '',
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at         TIMESTAMP WITH TIME ZONE
);

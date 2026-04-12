-- 001_initial_schema.sql
-- Coin Catalog initial schema
-- Claude-3Kx7:mexican-coin-platform | 2026-04-12
--
-- Tables: users, coins, batches, pop_reference, variety_reference
-- Design brief: docs/design-brief.md

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE denomination_enum AS ENUM (
    '20c', '10c', '50c', 'un_peso', '5_peso', '8_reales'
);

CREATE TYPE confidence_enum AS ENUM (
    'low', 'medium', 'high'
);

CREATE TYPE grader_enum AS ENUM (
    'NGC', 'PCGS', 'Raw'
);

CREATE TYPE submission_status_enum AS ENUM (
    'staged',
    'on_form',
    'shipped',
    'at_grader',
    'graded',
    'returned',
    'held_back'
);

-- ============================================================
-- USERS (auth)
-- ============================================================

CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login    TIMESTAMPTZ
);

-- ============================================================
-- BATCHES (submission groups)
-- ============================================================

CREATE TABLE batches (
    batch_id       SERIAL PRIMARY KEY,
    name           TEXT NOT NULL,
    grader         grader_enum NOT NULL,
    created_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shipped_date   DATE,
    returned_date  DATE,
    invoice_number TEXT
);

-- ============================================================
-- COINS (the queue -- 42 fields per design brief)
-- ============================================================

CREATE TABLE coins (
    -- Identity & physical (fields 1-10)
    coin_id                    TEXT PRIMARY KEY,
        -- Format: {denom}-{year}-{seq}, e.g. 20c-1907-006
        -- 3-digit zero-padded sequence per (denomination, year)
    denomination               denomination_enum NOT NULL,
    date_added                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    year                       INTEGER NOT NULL,
    mint_mark                  TEXT,
        -- Mo, C, S, etc. For 1915 Revolutionary: Puebla, Brigada, Ameca, etc.
    km_number                  TEXT,
        -- KM 435, KM 605, etc.
    variety_code               TEXT,
        -- Controlled vocabulary: STR7, CRV7, 1911/0, etc.
    variety_attribution_source TEXT,
        -- Where the variety claim originates: eye, Krause, NGC VarietyPlus, etc.
    ngc_variety_attribution    TEXT,
        -- NGC official name when verified
    pcgs_variety_attribution   TEXT,
        -- PCGS official name when verified

    -- Provenance & cost (fields 11-13)
    source                     TEXT,
        -- Dealer name, eBay seller, show, etc.
    acquisition_date           DATE,
    paid_usd                   NUMERIC(10,2),

    -- Condition assessment (fields 14-16)
    raw_grade_estimate         TEXT,
        -- Sheldon scale: AU55, MS63, etc.
    problem_flags              TEXT[] DEFAULT '{}',
        -- Array of: cleaned, environmental damage, rim ding, scratch, pvc, none
    details_risk               BOOLEAN DEFAULT FALSE,

    -- Imaging (fields 17-19)
    obverse_image_path         TEXT,
    reverse_image_path         TEXT,
    image_capture_date         TIMESTAMPTZ,

    -- Wager: hand prediction (fields 20-23)
    predicted_grade_hand       TEXT,
        -- Locked wager, Sheldon scale
    predicted_details_hand     BOOLEAN,
    confidence_hand            confidence_enum,
    prediction_date_hand       TIMESTAMPTZ,
        -- Immutable once set

    -- Wager: screen prediction (fields 24-26)
    predicted_grade_screen     TEXT,
    predicted_details_screen   BOOLEAN,
    prediction_date_screen     TIMESTAMPTZ,

    -- Submission packet (fields 27-34)
    grader                     grader_enum NOT NULL DEFAULT 'Raw',
    submission_status          submission_status_enum NOT NULL DEFAULT 'staged',
    tier                       TEXT,
        -- Grader-specific, validated by grader module
    declared_value_usd         NUMERIC(10,2),
    variety_plus_requested     BOOLEAN DEFAULT FALSE,
    submission_invoice_number  TEXT,
    line_number_on_form        INTEGER CHECK (line_number_on_form BETWEEN 1 AND 50),
    ship_date                  DATE,

    -- Results (fields 35-38)
    cert_number                TEXT,
    actual_grade               TEXT,
    actual_details             TEXT,
        -- e.g. Cleaned, Environmental Damage, or null
    return_date                DATE,

    -- Pop snapshots (frozen at ship time)
    ngc_pop_at_submission      INTEGER,
    pcgs_pop_at_submission     INTEGER,

    -- Misc
    notes                      TEXT,
    registry_set_id            TEXT,

    -- Batch FK
    batch_id                   INTEGER REFERENCES batches(batch_id),

    -- Constraints
    CONSTRAINT valid_year CHECK (year BETWEEN 1700 AND 2100),
    CONSTRAINT valid_line_number CHECK (
        line_number_on_form IS NULL
        OR line_number_on_form BETWEEN 1 AND 50
    )
);

-- Indexes for common query patterns
CREATE INDEX idx_coins_denomination_year ON coins (denomination, year);
CREATE INDEX idx_coins_submission_status ON coins (submission_status);
CREATE INDEX idx_coins_grader ON coins (grader);
CREATE INDEX idx_coins_batch_id ON coins (batch_id);

-- ============================================================
-- POP REFERENCE (population data cache)
-- ============================================================

CREATE TABLE pop_reference (
    pop_id              SERIAL PRIMARY KEY,
    km_number           TEXT NOT NULL,
    year                INTEGER NOT NULL,
    mint_mark           TEXT,
    variety_code        TEXT,
    ngc_total_pop       INTEGER,
    ngc_top_pop_grade   TEXT,
    ngc_top_pop_count   INTEGER,
    pcgs_total_pop      INTEGER,
    pcgs_top_pop_grade  TEXT,
    pcgs_top_pop_count  INTEGER,
    last_refreshed      TIMESTAMPTZ,
    UNIQUE (km_number, year, mint_mark, variety_code)
);

-- ============================================================
-- VARIETY REFERENCE (local cache of recognized varieties)
-- ============================================================

CREATE TABLE variety_reference (
    variety_id     SERIAL PRIMARY KEY,
    grader         grader_enum NOT NULL,
    denomination   denomination_enum NOT NULL,
    year           INTEGER NOT NULL,
    variety_code   TEXT NOT NULL,
    official_name  TEXT,
        -- NGC/PCGS official attribution name
    description    TEXT,
    source_url     TEXT,
    added_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (grader, denomination, year, variety_code)
);

-- ============================================================
-- SEQUENCE TRACKING (for coin_id generation)
-- ============================================================
-- Tracks the next available sequence number per (denomination, year).
-- Application layer reads + increments atomically when creating a coin.

CREATE TABLE coin_id_sequences (
    denomination  denomination_enum NOT NULL,
    year          INTEGER NOT NULL,
    next_seq      INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (denomination, year)
);

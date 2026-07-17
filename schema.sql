-- ------------------------------------------------------------
-- WALLETS TABLE
-- ------------------------------------------------------------ 

CREATE TABLE docq_mint_wallets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain           TEXT NOT NULL,            -- cardano
  address         TEXT NOT NULL UNIQUE,
  stake_address   TEXT NOT NULL UNIQUE,
  wallet_role     TEXT NOT NULL,            -- issuer | holder | system
  network         TEXT NOT NULL,            -- mainnet | preprod
  owner_id   UUID,                          -- (ref: docq_mint_users.id | docq_mint_schools.id)
  encrypted_seed_phrase     TEXT NOT NULL, -- encrypted with AES-256-GCM
  cached_balance_lovelace   TEXT,           -- last known on-chain balance (lovelace), TTL-cached
  balance_checked_at        TIMESTAMPTZ,    -- when cached_balance_lovelace was last refreshed from-chain
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- SCHOOLS TABLE
-- ------------------------------------------------------------ 

CREATE TABLE docq_mint_schools (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  country_code       TEXT,                  -- ISO 3166-1 alpha-2 code (e.g. US, CA, UK, etc.)
  compliance_region  TEXT,                  -- FERPA | GDPR | NZPA | MIXED
  logo_url           TEXT,                  -- S3 URL for org logo image
  custody_wallet_id  UUID REFERENCES docq_mint_wallets(id),                  -- nullable (for schools that are not custodians)
  credit_balance     INTEGER NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------
-- USERS TABLE
-- ------------------------------------------------------------ 

CREATE TABLE docq_mint_users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid       TEXT UNIQUE,             -- 🔑 Firebase UID
  email              TEXT,                    -- nullable (Firebase already validates)
  first_name         TEXT,
  last_name          TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE docq_mint_school_memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  school_id  UUID NOT NULL REFERENCES docq_mint_schools(id),
  user_id    UUID REFERENCES docq_mint_users(id), -- nullable for invite
  invite_email      TEXT,                         -- optional for invite
  invite_first_name TEXT,
  invite_last_name  TEXT,

  role       TEXT NOT NULL,
  -- owner | admin  | viewer | student | parent

  status     TEXT NOT NULL DEFAULT 'active', -- active | invited | removed

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  

  UNIQUE (school_id, user_id)
);



-- ------------------------------------------------------------
-- DOCUMENTS TABLE
-- ------------------------------------------------------------ 
CREATE TABLE docq_mint_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  school_id         UUID REFERENCES docq_mint_schools(id),                    -- nullable (ref: docq_mint_schools.id)
  student_id        UUID REFERENCES docq_mint_users(id),                    -- nullable (ref: could be a docq_mint_users.id or null)

  document_type     TEXT NOT NULL,           -- Enrollment/Identity: birth_certificate | national_id | address_proof | passport_photo
                                             -- Transfer/Admissions: transfer_certificate
                                             -- Academic: report_card | transcript | cumulative_record | diploma | certificate
                                             -- Health: health_fitness_card
                                             -- Catch-all: others
  file_storage_provider TEXT NOT NULL,        -- s3 | r2 | gcs | ipfs
  file_storage_url  TEXT NOT NULL,           -- https://s3.amazonaws.com/docq-mint/documents/1234567890.pdf
  file_hash         TEXT NOT NULL,           -- SHA256 / Blake2b (file-level)
  file_mime_type    TEXT,                    -- application/pdf, image/png, etc
  file_size_bytes   BIGINT,
  original_filename TEXT,                    -- Original filename from upload

  issued_at         TIMESTAMPTZ,             -- When document was issued as NFT (source of truth)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------
-- NFTs TABLE
-- ------------------------------------------------------------ 

CREATE TABLE docq_mint_nfts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  document_id        UUID NOT NULL REFERENCES docq_mint_documents(id),          -- off-chain source
  policy_id          TEXT,                    -- set after minting
  asset_name         TEXT,                    -- set after minting
  metadata           JSONB NOT NULL,          -- metadata for the NFT
  metadata_hash      TEXT,                    -- metadata hash

  tx_hash            TEXT,                    -- transaction hash (set after minting)
  ipfs_hash          TEXT,                    -- ipfs hash

  custody_wallet_id  UUID REFERENCES docq_mint_wallets(id),
  status             TEXT NOT NULL,           -- pending | minted | failed | burned | transferred

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- CLAIMS TABLE
-- ------------------------------------------------------------ 
CREATE TABLE docq_mint_claims (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nft_id            UUID REFERENCES docq_mint_nfts(id),
  user_id        UUID REFERENCES docq_mint_users(id),
  target_wallet_address  TEXT NOT NULL,

  status            TEXT, -- pending | paid | skipped
  request_tx_id     TEXT,
  request_timestamp TIMESTAMPTZ,

  submit_tx_id      TEXT,
  submit_timestamp TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- VERIFICATION TOKENS TABLE
-- ------------------------------------------------------------ 
CREATE TABLE docq_mint_verification_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID NOT NULL REFERENCES docq_mint_documents(id),
  token             TEXT NOT NULL UNIQUE,
  created_by        UUID REFERENCES docq_mint_users(id),
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- VERIFICATION ACCESS TABLE
-- ------------------------------------------------------------ 
CREATE TABLE docq_mint_verification_access (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id          UUID NOT NULL REFERENCES docq_mint_verification_tokens(id),
  verifier_email    TEXT,
  -- payment_status    TEXT NOT NULL DEFAULT 'pending', -- pending | paid (REMOVED)
  -- payment_amount    DECIMAL(10, 2) (REMOVED)
  -- accessed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  payment_id        UUID REFERENCES docq_mint_payments(id),
  verifier_id       UUID REFERENCES docq_mint_verifiers(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- VERIFIERS TABLE
-- ------------------------------------------------------------ 
CREATE TABLE docq_mint_verifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,

  stripe_customer_id TEXT UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_docq_mint_verifiers_name
ON docq_mint_verifiers(name);

-- ------------------------------------------------------------
-- VERIFIER MEMBERSHIPS TABLE
-- ------------------------------------------------------------ 
CREATE TABLE docq_mint_verifier_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verifier_id UUID NOT NULL REFERENCES docq_mint_verifiers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES docq_mint_users(id), -- nullable for invite
  invite_email      TEXT,
  invite_first_name TEXT,
  invite_last_name  TEXT,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (verifier_id, user_id)
);

CREATE INDEX idx_docq_mint_verifier_memberships_user
ON docq_mint_verifier_memberships(user_id);

-- ------------------------------------------------------------
-- PAYMENTS TABLE
-- ------------------------------------------------------------
CREATE TABLE docq_mint_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  payer_user_id UUID REFERENCES docq_mint_users(id),
  verifier_id UUID REFERENCES docq_mint_verifiers(id), -- nullable for user
  school_id UUID REFERENCES docq_mint_schools(id), -- nullable for user

  stripe_payment_intent_id TEXT UNIQUE,

  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',

  status TEXT NOT NULL,
  -- pending | succeeded | failed | refunded

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- TAGS TABLE  (per-school custom label vocabulary)
-- ------------------------------------------------------------
CREATE TABLE docq_mint_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES docq_mint_schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,               -- e.g. "2024 Cohort" | "Scholarship" | "Needs Review"
  color       TEXT,                        -- optional hex for UI chips, e.g. "#3b82f6"
  created_by  UUID REFERENCES docq_mint_users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One tag name per school, case-insensitive ("Scholarship" == "scholarship")
CREATE UNIQUE INDEX idx_docq_mint_tags_school_name ON docq_mint_tags(school_id, lower(name));

CREATE INDEX idx_docq_mint_tags_school ON docq_mint_tags(school_id);

-- ------------------------------------------------------------
-- DOCUMENT <-> TAG JOIN TABLE  (many-to-many)
-- ------------------------------------------------------------
CREATE TABLE docq_mint_document_tags (
  document_id UUID NOT NULL REFERENCES docq_mint_documents(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES docq_mint_tags(id)      ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (document_id, tag_id)        -- prevents attaching the same tag twice
);
-- Speeds up "which documents have tag X" (the filter query direction)
CREATE INDEX idx_docq_mint_document_tags_tag ON docq_mint_document_tags(tag_id);

-- Append-only ledger: every credit movement, for audit + history UI.
CREATE TABLE docq_mint_credit_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES docq_mint_schools(id) ON DELETE CASCADE,

  amount        INTEGER NOT NULL,        -- +N for grant/refund, -N for debit
  type          TEXT NOT NULL,           -- grant | debit | refund | adjustment
  balance_after INTEGER NOT NULL,        -- balance snapshot after this entry

  document_id   UUID REFERENCES docq_mint_documents(id),
  nft_id        UUID REFERENCES docq_mint_nfts(id),
  note          TEXT,

  created_by    UUID REFERENCES docq_mint_users(id),  -- admin actor; NULL = system
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_docq_mint_credit_tx_school ON docq_mint_credit_transactions(school_id, created_at DESC);
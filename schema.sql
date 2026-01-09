-- ------------------------------------------------------------
-- WALLETS TABLE
-- ------------------------------------------------------------ 

CREATE TABLE docq_mint_wallets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain           TEXT NOT NULL,            -- cardano
  address         TEXT NOT NULL UNIQUE,
  wallet_role     TEXT NOT NULL,            -- issuer | holder | system
  network         TEXT NOT NULL,            -- mainnet | preprod
  owner_id   UUID,                          -- (ref: docq_mint_users.id | docq_mint_schools.id)
  encrypted_seed_phrase     TEXT NOT NULL, -- encrypted with AES-256-GCM
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
  custody_wallet_id  UUID REFERENCES docq_mint_wallets(id),                  -- nullable (for schools that are not custodians)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------
-- USERS TABLE
-- ------------------------------------------------------------ 

CREATE TABLE docq_mint_users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid       TEXT UNIQUE,             -- 🔑 Firebase UID
  school_id          UUID REFERENCES docq_mint_schools(id),                    -- nullable (ref: docq_mint_schools.id)
  email              TEXT,                    -- nullable (Firebase already validates)
  role               TEXT NOT NULL,           -- admin | user
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE docq_mint_school_memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  school_id  UUID NOT NULL REFERENCES docq_mint_schools(id),
  user_id    UUID REFERENCES docq_mint_users(id), -- nullable for invite
  invite_email TEXT,                              -- optional for invite 

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

  document_type     TEXT NOT NULL,           -- report_card | transcript | certificate | diploma | others
  file_storage_provider TEXT NOT NULL,        -- s3 | r2 | gcs | ipfs
  file_storage_url  TEXT NOT NULL,           -- https://s3.amazonaws.com/docq-mint/documents/1234567890.pdf
  file_hash         TEXT NOT NULL,           -- SHA256 / Blake2b (file-level)
  file_mime_type    TEXT,                    -- application/pdf, image/png, etc
  file_size_bytes   BIGINT,

  encryption_key    TEXT,                    -- 🔐 used for NFT metadata / protected view
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------
-- NFTs TABLE
-- ------------------------------------------------------------ 

CREATE TABLE docq_mint_nfts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  document_id        UUID NOT NULL REFERENCES docq_mint_documents(id),          -- off-chain source
  policy_id          TEXT NOT NULL,
  asset_name         TEXT NOT NULL,
  metadata           JSONB NOT NULL,         -- metadata for the NFT
  metadata_hash      TEXT NOT NULL,           -- metadata hash

  tx_hash            TEXT NOT NULL,           -- transaction hash
  ipfs_hash          TEXT,           -- ipfs hash

  custody_wallet_id  UUID REFERENCES docq_mint_wallets(id),
  status             TEXT NOT NULL,           -- minted | burned | transferred | pending

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

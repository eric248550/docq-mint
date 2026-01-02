# DOCQ Mint – MVP Architecture & Functional Specification

## 1. Product Overview

DOCQ Mint is an academic document notarization and NFT minting system designed for schools and students.

Core goals:
- Allow schools to upload academic documents (reports, transcripts, certificates)
- Mint NFTs representing verified academic records
- Support custodial wallets during MVP phase

---

## 2. High-Level Architecture (MVP)

### Stack
- Frontend & API: Vercel (Full-stack)
- Authentication: Firebase Auth
- Database: Heroku PostgreSQL
- Blockchain: Cardano
- Data access: SQL-first (raw SQL via `pg`)
- Wallet model: Custodial (MVP only)

---

## 3. Core Domain Concepts

### 3.1 Wallet
A wallet represents a blockchain address controlled by DOCQ Mint during MVP.

Wallets can represent:
- System mint wallets (One minting policy for MVP)
- School custodial wallets
- Student custodial wallets

Wallet ownership is **logical**, not strictly enforced by foreign keys.

---

### 3.2 School
A school is an organizational entity that may:
- Upload documents
- Custody student wallets
- Mint NFTs to represent documents

Schools may or may not have a custodial wallet.

---

### 3.3 User
Users are authenticated via Firebase and may have roles such as:
- admin
- teacher
- student
- parent
- school_admin

Users may be associated with a school but are not guaranteed to own wallets permanently.

---

### 3.4 Document
A document is an off-chain academic artifact such as:
- Report card
- Transcript
- Certificate
- Diploma

Documents are stored externally (S3 / R2 / GCS / IPFS) and referenced by hash.

Documents may exist before minting and do not automatically imply NFT creation.

---

### 3.5 NFT
An NFT represents the on-chain notarization of a document.

Key properties:
- Always linked to a document
- Minted by a system wallet which under same policy
- Multiple NFTs can theoretically reference the same document (re-minting)

---

### 3.6 Mint Queue
The mint queue represents asynchronous minting jobs.

It supports:
- Batch minting

---

### 3.7 Claim
A claim represents a request by a user to claim or transfer an NFT. Lifecycle-driven by status.

Claims:
1. User select a/an specific NFT
2. Target an external wallet address
3. External wallet address send a gas fee (~2 ADA)
4. Custody wallet send the NFT to external wallet address


---

## 5. Wallet & Key Management (MVP)

### MVP Decision (Explicit Tradeoff)
- Wallet seed phrases are encrypted (AES-256-GCM)
- Encrypted seed is stored in the database (docq_mint_wallets.encrypted_seed_phrase)
- Decryption key is stored in environment variables (SEED_ENCRYPT_KEY)


---

## 7. Data Flow Examples

### Document Upload Flow
1. Admin uploads document
2. File stored in external storage (s3)
3. Hash and metadata saved in `docq_mint_documents`
4. Document exists without NFT

---

### NFT Mint Flow
1. System creates NFT record with status `pending`
2. Mint job added to mint queue
3. Mint transaction executed
4. NFT updated with `tx_hash` and status `minted`

---

### Claim Flow
1. User initiates claim
2. Claim record created with `pending` status
3. Target wallet address recorded
4. Transfer executed off-chain
5. Claim updated with transaction info
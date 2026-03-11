// Database types matching schema.sql

export interface DBWallet {
  id: string;
  chain: string;
  address: string;
  stake_address: string;
  wallet_role: string;
  network: string;
  owner_id: string | null;
  encrypted_seed_phrase: string;
  created_at: Date;
}

export interface DBSchool {
  id: string;
  name: string;
  country_code: string | null;
  compliance_region: string | null;
  custody_wallet_id: string | null;
  created_at: Date;
}

export interface DBUser {
  id: string;
  firebase_uid: string | null;
  email: string | null;
  created_at: Date;
}

export interface DBSchoolMembership {
  id: string;
  school_id: string;
  user_id: string | null;
  invite_email: string | null;
  role: string;
  status: string;
  created_at: Date;
}

export interface DBDocument {
  id: string;
  school_id: string | null;
  student_id: string | null;
  document_type: string;
  file_storage_provider: string;
  file_storage_url: string;
  file_hash: string;
  file_mime_type: string | null;
  file_size_bytes: number | null;
  original_filename: string | null;
  issued_at: Date | null;             // Source of truth: when document was issued as NFT
  created_at: Date;
  is_published?: boolean;              // Computed: issued_at IS NOT NULL
}

export interface DBNFT {
  id: string;
  document_id: string;
  policy_id: string;
  asset_name: string;
  metadata: any;
  metadata_hash: string;
  tx_hash: string;
  ipfs_hash: string | null;
  custody_wallet_id: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface DBClaim {
  id: string;
  nft_id: string | null;
  user_id: string | null;
  target_wallet_address: string;
  status: string | null;
  request_tx_id: string | null;
  request_timestamp: Date | null;
  submit_tx_id: string | null;
  submit_timestamp: Date | null;
}

export interface DBVerificationToken {
  id: string;
  document_id: string;
  token: string;
  created_by: string | null;
  expires_at: Date | null;
  created_at: Date;
}

export interface DBVerificationAccess {
  id: string;
  token_id: string;
  verifier_email: string | null;
  payment_id: string | null;
  verifier_id: string | null;
  created_at: Date;
}

export interface DBVerifier {
  id: string;
  name: string;
  stripe_customer_id: string | null;
  created_at: Date;
}

export interface DBVerifierMembership {
  id: string;
  verifier_id: string;
  user_id: string | null;
  invite_email: string | null;
  role: string;
  status: string;
  created_at: Date;
}

export interface DBPayment {
  id: string;
  payer_user_id: string | null;
  verifier_id: string | null;
  school_id: string | null;
  stripe_payment_intent_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: Date;
}

// API types
export type SchoolMembershipRole = 'owner' | 'admin' | 'viewer' | 'student' | 'parent';
export type MembershipStatus = 'active' | 'invited' | 'removed';
export type DocumentType = 'report_card' | 'transcript' | 'certificate' | 'diploma' | 'others';
export type IdentityContext = 'student' | 'school_admin' | 'verifier';
export type WalletRole = 'issuer' | 'holder' | 'system';
export type CardanoNetwork = 'mainnet' | 'preprod';


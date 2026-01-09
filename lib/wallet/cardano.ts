import { MeshWallet, BlockfrostProvider } from '@meshsdk/core';
import { query, queryOne } from '@/lib/db/config';
import crypto from 'crypto';

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.SEED_ENCRYPT_KEY || 'dev-key-32-characters-long!!'; // Must be 32 characters for AES-256

if (!process.env.SEED_ENCRYPT_KEY) {
  console.warn('⚠️  SEED_ENCRYPT_KEY not set. Using development key. DO NOT use in production!');
}

/**
 * Encrypt seed phrase using AES-256-GCM
 */
export function encryptSeedPhrase(seedPhrase: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(seedPhrase, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt seed phrase using AES-256-GCM
 */
export function decryptSeedPhrase(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Network configuration
 */
const NETWORK_CONFIG = {
  preprod: {
    networkId: 0,
    blockfrostApiKey: process.env.BLOCKFROST_API_KEY || '',
  },
  mainnet: {
    networkId: 1,
    blockfrostApiKey: process.env.BLOCKFROST_API_KEY || '',
  },
};

/**
 * Create a Cardano provider for the specified network
 */
function createProvider(network: 'mainnet' | 'preprod'): BlockfrostProvider {
  const config = NETWORK_CONFIG[network];
  
  if (!config.blockfrostApiKey) {
    throw new Error(`Blockfrost API key not found for ${network}. Set BLOCKFROST_${network.toUpperCase()}_API_KEY environment variable.`);
  }
  
  return new BlockfrostProvider(config.blockfrostApiKey);
}

/**
 * Generate a new Cardano wallet and return addresses
 */
export async function generateCardanoWallet(network: 'mainnet' | 'preprod' = 'preprod'): Promise<{
  mnemonic: string[];
  paymentAddress: string;
  stakeAddress: string;
}> {
  try {
    // Generate mnemonic (24 words) - returns string or string[]
    const mnemonicResult = MeshWallet.brew();
    const mnemonicString = typeof mnemonicResult === 'string' ? mnemonicResult : mnemonicResult.join(' ');
    const mnemonic = mnemonicString.split(' ');
    
    // Create provider for the network
    const provider = createProvider(network);
    const networkId = NETWORK_CONFIG[network].networkId as 0 | 1;
    
    // Initialize wallet with mnemonic
    const wallet = new MeshWallet({
      networkId,
      fetcher: provider,
      submitter: provider,
      key: {
        type: 'mnemonic',
        words: mnemonic,
      },
    });
    
    // Initialize cryptography
    await wallet.init();
    
    // Get addresses (these are synchronous methods)
    const paymentAddress = await Promise.resolve(wallet.getChangeAddress());
    const stakeAddresses = await Promise.resolve(wallet.getRewardAddresses());
    const stakeAddress = stakeAddresses[0] || '';
    
    return {
      mnemonic,
      paymentAddress,
      stakeAddress,
    };
  } catch (error) {
    console.error('Error generating Cardano wallet:', error);
    throw new Error('Failed to generate Cardano wallet');
  }
}

export interface DBWallet {
  id: string;
  chain: string;
  address: string;
  stake_address: string;
  wallet_role: string;
  network: string;
  owner_id: string;
  encrypted_seed_phrase: string;
  created_at: Date;
}

/**
 * Create a wallet in the database for a user or school
 */
export async function createWalletForOwner(
  ownerId: string,
  walletRole: 'issuer' | 'holder' | 'system',
  network: 'mainnet' | 'preprod' = 'preprod'
): Promise<DBWallet | null> {
  try {
    // Generate new Cardano wallet
    const { mnemonic, paymentAddress, stakeAddress } = await generateCardanoWallet(network);
    
    // Encrypt mnemonic
    const mnemonicString = mnemonic.join(' ');
    const encryptedSeedPhrase = encryptSeedPhrase(mnemonicString);
    
    // Insert wallet into database
    const wallet = await queryOne<DBWallet>(
      `INSERT INTO docq_mint_wallets 
       (chain, address, stake_address, wallet_role, network, owner_id, encrypted_seed_phrase)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      ['cardano', paymentAddress, stakeAddress, walletRole, network, ownerId, encryptedSeedPhrase]
    );
    
    if (!wallet) {
      throw new Error('Failed to insert wallet into database');
    }
    
    console.log(`✅ Created ${walletRole} wallet for owner ${ownerId} on ${network}`);
    console.log(`   Payment Address: ${paymentAddress}`);
    console.log(`   Stake Address: ${stakeAddress}`);
    
    return wallet;
  } catch (error) {
    console.error('Error creating wallet for owner:', error);
    return null;
  }
}

/**
 * Get wallet by owner ID
 */
export async function getWalletByOwnerId(ownerId: string): Promise<DBWallet | null> {
  return await queryOne<DBWallet>(
    'SELECT * FROM docq_mint_wallets WHERE owner_id = $1',
    [ownerId]
  );
}

/**
 * Get wallet by owner ID and wallet role
 */
export async function getWalletByOwnerIdAndRole(
  ownerId: string, 
  walletRole: 'issuer' | 'holder' | 'system'
): Promise<DBWallet | null> {
  return await queryOne<DBWallet>(
    'SELECT * FROM docq_mint_wallets WHERE owner_id = $1 AND wallet_role = $2',
    [ownerId, walletRole]
  );
}

/**
 * Load a MeshWallet instance from database
 */
export async function loadWalletFromDatabase(
  walletId: string,
  network: 'mainnet' | 'preprod' = 'preprod'
): Promise<MeshWallet | null> {
  try {
    // Get wallet from database
    const wallet = await queryOne<DBWallet>(
      'SELECT * FROM docq_mint_wallets WHERE id = $1',
      [walletId]
    );
    
    if (!wallet) {
      console.error('Wallet not found in database');
      return null;
    }
    
    // Decrypt seed phrase
    const mnemonicString = decryptSeedPhrase(wallet.encrypted_seed_phrase);
    const mnemonic = mnemonicString.split(' ');
    
    // Create provider
    const provider = createProvider(network);
    const networkId = NETWORK_CONFIG[network].networkId as 0 | 1;
    
    // Initialize MeshWallet
    const meshWallet = new MeshWallet({
      networkId,
      fetcher: provider,
      submitter: provider,
      key: {
        type: 'mnemonic',
        words: mnemonic,
      },
    });
    
    await meshWallet.init();
    
    return meshWallet;
  } catch (error) {
    console.error('Error loading wallet from database:', error);
    return null;
  }
}

/**
 * Get wallet balance from blockchain using address
 * @param address - Wallet address
 * @param network - Network to query (mainnet or preprod)
 * @returns Balance in lovelace (smallest unit of ADA, 1 ADA = 1,000,000 lovelace)
 */
export async function getWalletBalance(
  address: string,
  network: 'mainnet' | 'preprod' = 'preprod'
): Promise<string> {
  try {
    const provider = createProvider(network);
    
    // Fetch UTXOs for the address
    const utxos = await provider.fetchAddressUTxOs(address);
    
    // Calculate total balance by summing all UTXOs
    let totalLovelace = BigInt(0);
    
    for (const utxo of utxos) {
      // utxo.output.amount is an array of assets
      // The first element is always lovelace
      const lovelaceAmount = utxo.output.amount.find(
        (asset) => asset.unit === 'lovelace'
      );
      
      if (lovelaceAmount) {
        totalLovelace += BigInt(lovelaceAmount.quantity);
      }
    }
    
    return totalLovelace.toString();
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    throw new Error('Failed to fetch wallet balance from blockchain');
  }
}

/**
 * Get wallet balance using the wallet instance (from encrypted seed phrase)
 * @param walletId - Database wallet ID
 * @returns Balance in lovelace
 */
export async function getWalletBalanceById(walletId: string): Promise<string> {
  try {
    // Get wallet from database
    const dbWallet = await queryOne<DBWallet>(
      'SELECT * FROM docq_mint_wallets WHERE id = $1',
      [walletId]
    );
    
    if (!dbWallet) {
      throw new Error('Wallet not found');
    }
    
    // Load MeshWallet instance
    const meshWallet = await loadWalletFromDatabase(walletId, dbWallet.network as 'mainnet' | 'preprod');
    
    if (!meshWallet) {
      throw new Error('Failed to load wallet');
    }
    
    // Get balance using MeshWallet
    const lovelace = await meshWallet.getLovelace();
    
    return lovelace;
  } catch (error) {
    console.error('Error fetching wallet balance by ID:', error);
    throw new Error('Failed to fetch wallet balance');
  }
}


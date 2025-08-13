import Dexie, { Table } from 'dexie'

export interface Doc {
  id: string
  title: string
  url: string
  summary?: string
  source?: string
  version?: number
  crdtClock?: any
  packId?: string
}

export interface ContentPack { 
  id: string; 
  name: string; 
  size: number;
  sha256: string;
  keyId: string;
  pubkey: string;
  sigB64: string;
  installedAt: number;
  status: 'installing' | 'installed' | 'failed';
  opfsPath?: string;
  verificationStatus?: 'valid' | 'invalid' | 'pending';
  verifiedAt?: number;
}
export interface Delta { id:string; ts:number; payload:any; sig:string }
export interface PurchaseIntent { id:string; ts:number; payload:any; status:'queued'|'sending'|'ok'|'err'; lastError?: string }
export interface Receipt { id:string; intentId:string; ts:number; payload:any; sig:string; keyId?: string; status?: 'verified' | 'invalid' | 'pending' }
export interface RecentMessage { msgId: string; ts: number }
export interface KeySalt { id: string; salt: Uint8Array; createdAt: number }

export class LocalDB extends Dexie { 
  docs!: Table<Doc, string>
  contentPacks!: Table<ContentPack,string>
  deltas!: Table<Delta,string>
  purchaseQueue!: Table<PurchaseIntent,string>
  receipts!: Table<Receipt, string>
  recentMessages!: Table<RecentMessage, string>
  keySalts!: Table<KeySalt, string>
  
  constructor(){ 
    super('grahmos')
    this.version(5).stores({
      docs: 'id,title,url,summary',
      contentPacks:'id', 
      deltas:'id, ts', 
      purchaseQueue:'id, ts, status',
      receipts: 'id, intentId, ts',
      recentMessages: 'msgId, ts',
      keySalts: 'id, createdAt'
    }).upgrade(tx => {
    })
  }
}

export const db = new LocalDB()

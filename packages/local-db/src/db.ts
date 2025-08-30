import Dexie from 'dexie'
import type { Table } from 'dexie'

export interface Doc {
  id: string
  title: string
  url: string
  summary?: string
}

export interface ContentPack { id:string; name:string; version:string; signature:string; installedAt:number }
export interface Delta { id:string; ts:number; payload:any; sig:string }
export interface PurchaseIntent { id:string; ts:number; payload:any; status:'queued'|'sending'|'ok'|'err'; lastError?: string }
export interface Receipt { id:string; intentId:string; ts:number; payload:any; sig:string }

export class LocalDB extends Dexie { 
  docs!: Table<Doc, string>
  contentPacks!: Table<ContentPack,string>
  deltas!: Table<Delta,string>
  purchaseQueue!: Table<PurchaseIntent,string>
  receipts!: Table<Receipt, string>
  
  constructor(){ 
    super('grahmos')
    this.version(3).stores({
      docs: 'id,title,url,summary',
      contentPacks:'id', 
      deltas:'id, ts', 
      purchaseQueue:'id, ts, status',
      receipts: 'id, intentId, ts'
    }).upgrade(tx => {
    })
  } 
}

export const db = new LocalDB()

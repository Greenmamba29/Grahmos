'use client'
import { db, type PurchaseIntent } from '../../../../packages/local-db/src/db'

export async function enqueuePurchase(payload: Record<string, unknown>){
  const id = 'pi_' + Math.random().toString(36).slice(2)
  const intent: PurchaseIntent = { id, ts: Date.now(), payload, status: 'queued' }
  await db.purchaseQueue.put(intent)
  return id
}

export async function flushPurchases(pubkeyB64:string){
  const intents = await db.purchaseQueue.where('status').equals('queued').toArray()
  for (const it of intents){
    try {
      await db.purchaseQueue.update(it.id, { status: 'sending', lastError: '' })
      const res = await fetch('/purchase', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ intentId: it.id, payload: it.payload }) })
      if (!res.ok) throw new Error('purchase failed: '+res.status)
      const { receipt, sig } = await res.json()
      const { verifyReceipt } = await import('../../../../packages/crypto-verify/src/receipt')
      const ok = verifyReceipt(pubkeyB64, receipt, sig)
      if (!ok) throw new Error('bad receipt signature')
      await db.receipts.put({ id: receipt.orderId, intentId: it.id, ts: receipt.ts, payload: receipt, sig })
      await db.purchaseQueue.update(it.id, { status: 'ok' })
    } catch(e: unknown){
      const errorMessage = e instanceof Error ? e.message : String(e);
      await db.purchaseQueue.update(it.id, { status: 'queued', lastError: errorMessage })
    }
  }
}
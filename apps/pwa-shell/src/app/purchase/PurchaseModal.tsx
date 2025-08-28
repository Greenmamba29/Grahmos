'use client'
import React, { useEffect, useState } from 'react'
import useOnline from '@/lib/useOnline'
import { enqueuePurchase, flushPurchases } from '@/lib/purchase'

export default function PurchaseModal({ item, onClose }:{ item:{ id:string; name:string; price:number }; onClose: ()=>void }){
  const online = useOnline()
  const [busy,setBusy] = useState(false)
  const [msg,setMsg] = useState('')
  const [pubkey,setPubkey] = useState('')

  useEffect(()=>{ (async()=>{
    const r = await fetch('/pubkey').then(r=>r.json()).catch(()=>({pubkey:''}))
    setPubkey(r.pubkey || '')
  })() },[])

  async function onBuy(){
    setBusy(true); setMsg('Queuing order…')
    await enqueuePurchase({ itemId:item.id, amount: item.price, currency:'usd' })
    setMsg('Queued. ' + (online? 'Processing…':'You are offline; will process later.'))
    if (online && pubkey) { await flushPurchases(pubkey); setMsg('Done (if verified). Check Orders.') }
    setBusy(false)
  }

  useEffect(()=>{ // auto flush when online
    if (!pubkey) return
    if (online) flushPurchases(pubkey)
  },[online,pubkey])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 w-full max-w-md space-y-3">
        <div className="text-lg font-semibold">Buy {item.name}</div>
        <div className="opacity-70 text-sm">${item.price.toFixed(2)} USD</div>
        <div className="flex gap-2">
          <button disabled={busy} onClick={onBuy} className="px-3 py-2 rounded bg-emerald-700 disabled:opacity-50">Confirm</button>
          <button disabled={busy} onClick={onClose} className="px-3 py-2 rounded bg-neutral-800">Cancel</button>
        </div>
        {msg && <div className="text-xs opacity-70">{msg}</div>}
      </div>
    </div>
  )
}

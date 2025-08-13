import nacl from 'tweetnacl'
import * as util from 'tweetnacl-util'

function canon(obj:any){ return JSON.stringify(obj, Object.keys(obj).sort()) }

export default {
  async fetch(req: Request, env: any) {
    const url = new URL(req.url)

    if (url.pathname === '/purchase' && req.method === 'POST') {
      const body = await req.json().catch(()=>null)
      if (!body || !body.intentId || !body.payload) return new Response('bad request', { status: 400 })

      const now = Date.now()
      const orderId = 'ord_' + Math.random().toString(36).slice(2)

      const receipt = {
        intentId: body.intentId,
        orderId,
        amount: body.payload.amount,
        currency: body.payload.currency || 'usd',
        itemId: body.payload.itemId,
        ts: now,
        status: 'paid'
      }

      const secretB64 = env.RECEIPT_PRIVATE_KEY
      if (!secretB64) return new Response('server key missing', { status: 500 })
      const secretKey = util.decodeBase64(secretB64)
      const msg = util.decodeUTF8(canon(receipt))
      const sig = nacl.sign.detached(msg, secretKey)
      const sigB64 = util.encodeBase64(sig)

      return new Response(JSON.stringify({ receipt, sig: sigB64 }), {
        headers: { 'content-type': 'application/json' }
      })
    }

    if (url.pathname === '/pubkey') {
      return new Response(JSON.stringify({ pubkey: env.RECEIPT_PUBLIC_KEY || '' }), { headers: { 'content-type': 'application/json' }})
    }

    if (url.pathname === '/library') {
      return new Response(JSON.stringify({ packs: [] }), { headers: { 'content-type': 'application/json' }})
    }

    return new Response('ok')
  }
}

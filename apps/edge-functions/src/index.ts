import nacl from 'tweetnacl'
import * as util from 'tweetnacl-util'

function canon(obj:any){ return JSON.stringify(obj, Object.keys(obj).sort()) }

// Rate limiting helper
async function checkRateLimit(env: any, ip: string, intentId: string): Promise<boolean> {
  const key = `ratelimit:${ip}:${intentId}`
  const windowKey = `window:${ip}`
  const now = Math.floor(Date.now() / 1000)
  const windowStart = Math.floor(now / 300) * 300 // 5-minute windows
  
  try {
    // Check if this specific intentId was already processed (idempotency)
    const existing = await env.ORDERS?.get(intentId)
    if (existing) {
      return true // Allow reprocessing existing orders
    }
    
    // Simple token bucket: 30 requests per 5 minutes per IP
    const currentWindow = await env.ORDERS?.get(windowKey)
    const requests = currentWindow ? parseInt(currentWindow) : 0
    
    if (requests >= 30) {
      return false // Rate limit exceeded
    }
    
    // Increment counter with TTL
    await env.ORDERS?.put(windowKey, (requests + 1).toString(), { expirationTtl: 300 })
    return true
  } catch (e) {
    console.warn('Rate limit check failed:', e)
    return true // Fail open
  }
}

// Validation helper
function validatePurchasePayload(payload: any): { valid: boolean, error?: string } {
  if (!payload) return { valid: false, error: 'Missing payload' }
  
  if (typeof payload.amount !== 'number' || payload.amount <= 0) {
    return { valid: false, error: 'Invalid amount' }
  }
  
  if (!payload.currency || typeof payload.currency !== 'string' || payload.currency.length !== 3) {
    return { valid: false, error: 'Invalid currency' }
  }
  
  if (!payload.itemId || typeof payload.itemId !== 'string') {
    return { valid: false, error: 'Invalid itemId' }
  }
  
  return { valid: true }
}

export default {
  async fetch(req: Request, env: any) {
    const url = new URL(req.url)
    const ip = req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown'

    if (url.pathname === '/purchase' && req.method === 'POST') {
      try {
        // Check payload size (32KB limit)
        const contentLength = req.headers.get('content-length')
        if (contentLength && parseInt(contentLength) > 32768) {
          return new Response(JSON.stringify({ error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' }), { 
            status: 413,
            headers: { 'content-type': 'application/json' }
          })
        }

        const body = await req.json().catch(()=>null)
        if (!body || !body.intentId || !body.payload) {
          return new Response(JSON.stringify({ error: 'Bad request format', code: 'INVALID_FORMAT' }), { 
            status: 400,
            headers: { 'content-type': 'application/json' }
          })
        }

        // Validate payload structure
        const validation = validatePurchasePayload(body.payload)
        if (!validation.valid) {
          return new Response(JSON.stringify({ error: validation.error, code: 'INVALID_PAYLOAD' }), {
            status: 400,
            headers: { 'content-type': 'application/json' }
          })
        }

        // Check rate limit and idempotency
        const allowed = await checkRateLimit(env, ip, body.intentId)
        if (!allowed) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded', code: 'RATE_LIMIT' }), {
            status: 429,
            headers: { 'content-type': 'application/json' }
          })
        }

        // Check for existing order (idempotency)
        const existingOrder = await env.ORDERS?.get(body.intentId)
        if (existingOrder) {
          return new Response(existingOrder, {
            headers: { 'content-type': 'application/json' }
          })
        }

        const now = Date.now()
        const orderId = 'ord_' + Math.random().toString(36).slice(2)
        const keyId = env.RECEIPT_KEY_ID || 'default'

        const receipt = {
          intentId: body.intentId,
          orderId,
          keyId,
          amount: body.payload.amount,
          currency: body.payload.currency,
          itemId: body.payload.itemId,
          ts: now,
          status: 'paid'
        }

        const secretB64 = env.RECEIPT_PRIVATE_KEY
        if (!secretB64) {
          return new Response(JSON.stringify({ error: 'Server key missing', code: 'SERVER_ERROR' }), { 
            status: 500,
            headers: { 'content-type': 'application/json' }
          })
        }
        
        const secretKey = util.decodeBase64(secretB64)
        const msg = util.decodeUTF8(canon(receipt))
        const sig = nacl.sign.detached(msg, secretKey)
        const sigB64 = util.encodeBase64(sig)

        const response = { receipt, sig: sigB64 }
        const responseJson = JSON.stringify(response)

        // Store in KV for idempotency
        await env.ORDERS?.put(body.intentId, responseJson, { expirationTtl: 86400 }) // 24h TTL

        return new Response(responseJson, {
          headers: { 'content-type': 'application/json' }
        })
      } catch (error) {
        console.error('Purchase processing error:', error)
        return new Response(JSON.stringify({ error: 'Internal server error', code: 'SERVER_ERROR' }), {
          status: 500,
          headers: { 'content-type': 'application/json' }
        })
      }
    }

    if (url.pathname === '/pubkey') {
      const keyId = env.RECEIPT_KEY_ID || 'default'
      const pubkey = env.RECEIPT_PUBLIC_KEY || ''
      return new Response(JSON.stringify({ keyId, pubkey }), { 
        headers: { 'content-type': 'application/json' }
      })
    }

    if (url.pathname === '/library') {
      return new Response(JSON.stringify({ packs: [] }), { headers: { 'content-type': 'application/json' }})
    }

    return new Response('ok')
  }
}

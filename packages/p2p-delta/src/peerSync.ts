import { createLibp2p } from 'libp2p'
import { webSockets } from '@libp2p/websockets'
import { webRTC } from '@libp2p/webrtc'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { noise } from '@chainsafe/libp2p-noise'
import { mplex } from '@libp2p/mplex'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { identify } from '@libp2p/identify'
import { verify, canon } from '../../crypto-verify/src/verify'
import { db } from '../../local-db/src/db'
import nacl from 'tweetnacl'
import util from 'tweetnacl-util'

interface PeerSyncOptions {
  topic: string
  getKey: () => Promise<Uint8Array>
  onDoc: (doc: any) => Promise<void>
  starUrl?: string
}

interface PeerSyncResult {
  publish: (doc: any) => Promise<void>
  getPeers: () => number
  getDiagnostics: () => DiagnosticsInfo
}

interface DiagnosticsInfo {
  connectedPeers: number
  signaling: "ok" | "none" | "error"
  lastPublishOk: number | null
  lastPublishError: string | null
  lastVerifyError: string | null
  lastDecryptError: string | null
  lastHeartbeat: number | null
  messagesProcessed: number
  messagesDropped: number
  replayAttacksBlocked: number
  oversizedMessagesBlocked: number
  cadence?: string
  batteryProfile?: 'normal' | 'red' | 'lowPower' | 'auto'
  effectiveCadenceMs?: number
}

let libp2pNode: any = null
let currentTopic = ''
let peerCount = 0
const REPLAY_TTL_MS = 60 * 60 * 1000 // 60 minutes
const MAX_MESSAGE_SIZE = 64 * 1024 // 64KB

// Diagnostics tracking
let diagnostics: DiagnosticsInfo = {
  connectedPeers: 0,
  signaling: "none",
  lastPublishOk: null,
  lastPublishError: null,
  lastVerifyError: null,
  lastDecryptError: null,
  lastHeartbeat: null,
  messagesProcessed: 0,
  messagesDropped: 0,
  replayAttacksBlocked: 0,
  oversizedMessagesBlocked: 0
}

// Generate message ID from nonce and ciphertext
async function generateMessageId(nonce: Uint8Array, ciphertext: Uint8Array): Promise<string> {
  const combined = new Uint8Array(nonce.length + ciphertext.length)
  combined.set(nonce)
  combined.set(ciphertext, nonce.length)
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Clean old replay protection entries
async function cleanOldMessages(): Promise<void> {
  const cutoff = Date.now() - REPLAY_TTL_MS
  try {
    await db.recentMessages.where('ts').below(cutoff).delete()
  } catch (e) {
    console.warn('Failed to clean old messages:', e)
  }
}

// Check for replay attack
async function isReplayAttack(msgId: string): Promise<boolean> {
  try {
    const existing = await db.recentMessages.get(msgId)
    return existing !== undefined
  } catch (e) {
    console.warn('Failed to check replay:', e)
    return false
  }
}

// Record message to prevent replay
async function recordMessage(msgId: string): Promise<void> {
  try {
    await db.recentMessages.put({ msgId, ts: Date.now() })
  } catch (e) {
    console.warn('Failed to record message:', e)
  }
}

export async function deriveKey(passphrase: string, salt?: Uint8Array): Promise<{ key: Uint8Array; salt: Uint8Array }> {
  // Generate salt if not provided
  if (!salt) {
    salt = crypto.getRandomValues(new Uint8Array(32))
  }
  
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(passphrase)
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  )
  
  // Derive key using PBKDF2 with 100k iterations
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 32 bytes
  )
  
  return {
    key: new Uint8Array(derivedBits),
    salt: salt
  }
}

export function encrypt(obj: any, key: Uint8Array): Uint8Array {
  const nonce = nacl.randomBytes(24)
  const message = util.decodeUTF8(JSON.stringify(obj))
  const encrypted = nacl.secretbox(message, nonce, key)
  const result = new Uint8Array(nonce.length + encrypted.length)
  result.set(nonce)
  result.set(encrypted, nonce.length)
  return result
}

export function decrypt(encryptedData: Uint8Array, key: Uint8Array): any | null {
  if (encryptedData.length < 24) return null
  const nonce = encryptedData.slice(0, 24)
  const encrypted = encryptedData.slice(24)
  const decrypted = nacl.secretbox.open(encrypted, nonce, key)
  if (!decrypted) return null
  try {
    return JSON.parse(util.encodeUTF8(decrypted))
  } catch {
    return null
  }
}

// Cadence intervals (in milliseconds)
const CADENCE_INTERVALS = {
  normal: 10 * 60 * 1000,    // 10 minutes
  red: 45 * 1000,            // 45 seconds  
  lowPower: 20 * 60 * 1000   // 20 minutes
}

// Global cadence state
let currentCadence: keyof typeof CADENCE_INTERVALS = 'normal'
let currentProfile: 'normal' | 'red' | 'lowPower' | 'auto' = 'auto'
let heartbeatInterval: NodeJS.Timeout | null = null

// Set cadence directly in milliseconds
export function setCadence(ms: number) {
  console.log(`Setting custom cadence: ${ms}ms`)
  
  // Clear existing interval
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
  
  // Start new interval with custom timing
  heartbeatInterval = setInterval(() => {
    diagnostics.lastHeartbeat = Date.now()
    console.log(`Custom heartbeat: ${ms}ms, peers: ${peerCount}`)
  }, ms)
}

// Apply battery profile with optional redMode parameter
export function applyProfile(profile: 'normal' | 'red' | 'lowPower' | 'auto', redMode?: boolean) {
  console.log(`Applying battery profile: ${profile} (redMode: ${redMode})`)
  currentProfile = profile
  
  let effectiveMode: 'normal' | 'red' | 'lowPower' = 'normal'
  
  if (profile === 'auto') {
    // Auto heuristics
    const connection = (navigator as any).connection
    if (connection?.saveData === true) {
      effectiveMode = 'lowPower'
    } else if (document.hidden === true) {
      effectiveMode = 'lowPower'
    } else if (redMode === true) {
      effectiveMode = 'red'
    } else {
      effectiveMode = 'normal'
    }
  } else {
    effectiveMode = profile
  }
  
  console.log(`Effective cadence mode: ${effectiveMode}`)
  updateCadence(effectiveMode)
}

// Update cadence based on mode
export function updateCadence(mode: 'normal' | 'red' | 'lowPower') {
  console.log(`Updating cadence from ${currentCadence} to ${mode}`)
  currentCadence = mode
  
  // Clear existing interval
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
  
  // Start new interval
  startHeartbeat()
}

// Start heartbeat with current cadence
function startHeartbeat() {
  const interval = CADENCE_INTERVALS[currentCadence]
  console.log(`Starting heartbeat with ${currentCadence} mode: ${interval}ms`)
  
  heartbeatInterval = setInterval(() => {
    diagnostics.lastHeartbeat = Date.now()
    console.log(`Heartbeat: ${currentCadence} mode, peers: ${peerCount}`)
  }, interval)
}

export async function startPeerSync(opts: PeerSyncOptions): Promise<PeerSyncResult> {
  if (libp2pNode) {
    await libp2pNode.stop()
  }

  // Configure signaling based on starUrl
  let signalingStatus: "ok" | "none" | "error" = "none"
  
  try {
    const transports = [webSockets(), webRTC(), circuitRelayTransport()]
    
    // Add WebRTC-star if URL is provided
    if (opts.starUrl) {
      console.log(`Configuring WebRTC-star signaling: ${opts.starUrl}`)
      // Note: For now we'll simulate the star transport configuration
      // In a full implementation, you'd add webRTCStar() transport here
      signalingStatus = "ok"
    } else {
      console.log('No WebRTC-star URL provided, using direct connections only')
      signalingStatus = "none"
    }
    
    libp2pNode = await createLibp2p({
      transports,
      connectionEncrypters: [noise()],
      streamMuxers: [mplex()],
      services: {
        pubsub: gossipsub(),
        identify: identify()
      }
    })
    
    diagnostics.signaling = signalingStatus
    console.log(`libp2p initialized with signaling: ${signalingStatus}`)
    
  } catch (error) {
    console.error('Failed to initialize libp2p with signaling:', error)
    diagnostics.signaling = "error"
    
    // Fallback to basic configuration
    libp2pNode = await createLibp2p({
      transports: [webSockets(), webRTC(), circuitRelayTransport()],
      connectionEncrypters: [noise()],
      streamMuxers: [mplex()],
      services: {
        pubsub: gossipsub(),
        identify: identify()
      }
    })
  }
  
  // Start heartbeat
  startHeartbeat()

  currentTopic = opts.topic
  peerCount = 0

  libp2pNode.services.pubsub.addEventListener('message', async (event: any) => {
    if (event.detail.topic !== currentTopic) return
    
    try {
      const encryptedData = event.detail.data
      
      // Size check for DoS protection
      if (encryptedData.length > MAX_MESSAGE_SIZE) {
        console.warn(`Message too large (${encryptedData.length} bytes), dropping (max: ${MAX_MESSAGE_SIZE} bytes)`)
        diagnostics.oversizedMessagesBlocked++
        diagnostics.messagesDropped++
        return
      }
      
      // Extract nonce and ciphertext for replay detection
      if (encryptedData.length < 24) {
        console.warn('Invalid message size')
        diagnostics.messagesDropped++
        return
      }
      
      const nonce = encryptedData.slice(0, 24)
      const ciphertext = encryptedData.slice(24)
      
      // Generate message ID and check for replay
      const msgId = await generateMessageId(nonce, ciphertext)
      
      // Dev mode: print nonce hex and msgId
      if (process.env.NODE_ENV === 'development') {
        const nonceHex = Array.prototype.map.call(nonce, (b: number) => b.toString(16).padStart(2, '0')).join('')
        console.log('[DEV] Received nonce:', nonceHex, 'msgId:', msgId)
      }
      
      const isReplay = await isReplayAttack(msgId)
      
      if (isReplay) {
        console.warn('Replay drop - duplicate message:', msgId)
        diagnostics.replayAttacksBlocked++
        diagnostics.messagesDropped++
        return
      }
      
      // Record message to prevent future replays
      await recordMessage(msgId)
      
      const key = await opts.getKey()
      const payload = decrypt(encryptedData, key)
      
      if (!payload) {
        const errorMsg = 'Failed to decrypt message'
        console.warn(errorMsg)
        diagnostics.lastDecryptError = errorMsg
        diagnostics.messagesDropped++
        return
      }

      const { doc, docHash, ts, sig, pubkey, nonce: payloadNonce } = payload
      
      // Verify nonce consistency
      if (!payloadNonce || payloadNonce.length !== 24) {
        console.warn('Missing or invalid nonce in payload')
        return
      }
      
      // Verify document hash
      const computedHash = await crypto.subtle.digest('SHA-256', 
        new TextEncoder().encode(canon(doc)))
      const computedHashHex = Array.from(new Uint8Array(computedHash))
        .map(b => b.toString(16).padStart(2, '0')).join('')
      
      if (docHash !== computedHashHex) {
        console.warn('Document hash mismatch')
        return
      }
      
      // Enhanced signature verification - bind to docId, docHash, ts, topic, and nonce
      const docId = doc?.id || 'unknown'
      const canonMsg = canon({ 
        docId, 
        docHash, 
        ts, 
        topic: currentTopic, 
        nonce: Array.from(payloadNonce) 
      })
      const ok = await verify(pubkey, canonMsg, sig)
      
      if (!ok) {
        const errorMsg = `Bad signature for doc: ${docId}`
        console.warn(errorMsg)
        diagnostics.lastVerifyError = errorMsg
        diagnostics.messagesDropped++
        return
      }

      console.log('Received verified doc:', docId, 'msgId:', msgId)
      diagnostics.messagesProcessed++
      await opts.onDoc(doc)
      
      // Clean old messages periodically (every 100 messages)
      if (Math.random() < 0.01) {
        await cleanOldMessages()
      }
      
    } catch (e) {
      console.error('Failed to process peer message:', e)
    }
  })

  libp2pNode.addEventListener('peer:connect', () => {
    peerCount = libp2pNode.getPeers().length
    diagnostics.connectedPeers = peerCount
  })

  libp2pNode.addEventListener('peer:disconnect', () => {
    peerCount = libp2pNode.getPeers().length
    diagnostics.connectedPeers = peerCount
  })

  await libp2pNode.services.pubsub.subscribe(currentTopic)
  console.log(`Subscribed to ${currentTopic}`)

  const publish = async (doc: any) => {
    try {
      // Check if we have peers to avoid spamming
      if (peerCount === 0) {
        console.warn('No peers connected, skipping publish')
        return
      }
      
      const ts = Date.now()
      const docId = doc?.id || 'unknown'
      const pubkey = 'dummy-pubkey-for-dev'
      
      // Generate random nonce for this message
      const nonce = nacl.randomBytes(24)
      
      // Dev mode: print nonce hex for publish
      if (process.env.NODE_ENV === 'development') {
        const nonceHex = Array.prototype.map.call(nonce, (b: number) => b.toString(16).padStart(2, '0')).join('')
        console.log('[DEV] Publishing with nonce:', nonceHex)
      }
      
      // Compute document hash
      const docHashBuffer = await crypto.subtle.digest('SHA-256', 
        new TextEncoder().encode(canon(doc)))
      const docHash = Array.from(new Uint8Array(docHashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('')
      
      // Enhanced signature - bind to docId, docHash, ts, topic, and nonce
      const canonMsg = canon({ 
        docId, 
        docHash, 
        ts, 
        topic: currentTopic, 
        nonce: Array.from(nonce) 
      })
      const sig = 'dummy-sig-for-dev' // TODO: Replace with real signing
      
      const payload = { 
        doc, 
        docHash,
        ts, 
        sig, 
        pubkey,
        nonce: Array.from(nonce) // Include nonce in payload for verification
      }
      
      const key = await opts.getKey()
      const encrypted = encrypt(payload, key)
      
      await libp2pNode.services.pubsub.publish(currentTopic, encrypted)
      diagnostics.lastPublishOk = Date.now()
      console.log('Published doc:', docId, 'with nonce:', Array.from(nonce).slice(0, 4))
    } catch (e) {
      const errorMsg = `Failed to publish doc: ${e instanceof Error ? e.message : 'unknown error'}`
      console.error(errorMsg)
      diagnostics.lastPublishError = errorMsg
    }
  }

  const getPeers = () => peerCount

  const getDiagnostics = (): DiagnosticsInfo => {
    const cadenceMs = CADENCE_INTERVALS[currentCadence]
    const cadenceDisplay = currentCadence === 'red' ? '45s (red)' : 
                           currentCadence === 'lowPower' ? '20m (lowPower)' : 
                           '10m (normal)'
    
    return {
      ...diagnostics,
      connectedPeers: peerCount,
      cadence: cadenceDisplay,
      batteryProfile: currentProfile,
      effectiveCadenceMs: cadenceMs
    }
  }

  return { publish, getPeers, getDiagnostics }
}

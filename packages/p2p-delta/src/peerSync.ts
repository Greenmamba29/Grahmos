import { createLibp2p } from 'libp2p'
import { webSockets } from '@libp2p/websockets'
import { webRTC } from '@libp2p/webrtc'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { noise } from '@chainsafe/libp2p-noise'
import { mplex } from '@libp2p/mplex'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { identify } from '@libp2p/identify'
import { verify, canon } from '../../crypto-verify/src/verify'
import nacl from 'tweetnacl'
import util from 'tweetnacl-util'

interface PeerSyncOptions {
  topic: string
  getKey: () => Promise<Uint8Array>
  onDoc: (doc: any) => Promise<void>
}

interface PeerSyncResult {
  publish: (doc: any) => Promise<void>
  getPeers: () => number
}

let libp2pNode: any = null
let currentTopic = ''
let peerCount = 0

export async function deriveKey(passphrase: string): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const data = encoder.encode(passphrase)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(hashBuffer)
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

export async function startPeerSync(opts: PeerSyncOptions): Promise<PeerSyncResult> {
  if (libp2pNode) {
    await libp2pNode.stop()
  }

  libp2pNode = await createLibp2p({
    transports: [webSockets(), webRTC(), circuitRelayTransport()],
    connectionEncrypters: [noise()],
    streamMuxers: [mplex()],
    services: {
      pubsub: gossipsub(),
      identify: identify()
    }
  })

  currentTopic = opts.topic
  peerCount = 0

  libp2pNode.services.pubsub.addEventListener('message', async (event: any) => {
    if (event.detail.topic !== currentTopic) return
    
    try {
      const encryptedData = event.detail.data
      const key = await opts.getKey()
      const payload = decrypt(encryptedData, key)
      
      if (!payload) {
        console.warn('Failed to decrypt message')
        return
      }

      const { doc, ts, sig, pubkey } = payload
      const canonMsg = canon({ doc, ts })
      const ok = await verify(pubkey, canonMsg, sig)
      
      if (!ok) {
        console.warn('Bad signature for doc:', doc?.id)
        return
      }

      console.log('Received verified doc:', doc?.id)
      await opts.onDoc(doc)
    } catch (e) {
      console.error('Failed to process peer message:', e)
    }
  })

  libp2pNode.addEventListener('peer:connect', () => {
    peerCount = libp2pNode.getPeers().length
  })

  libp2pNode.addEventListener('peer:disconnect', () => {
    peerCount = libp2pNode.getPeers().length
  })

  await libp2pNode.services.pubsub.subscribe(currentTopic)
  console.log(`Subscribed to ${currentTopic}`)

  const publish = async (doc: any) => {
    try {
      const ts = Date.now()
      const pubkey = 'dummy-pubkey-for-dev'
      const canonMsg = canon({ doc, ts })
      const sig = 'dummy-sig-for-dev'
      
      const payload = { doc, ts, sig, pubkey }
      const key = await opts.getKey()
      const encrypted = encrypt(payload, key)
      
      await libp2pNode.services.pubsub.publish(currentTopic, encrypted)
      console.log('Published doc:', doc.id)
    } catch (e) {
      console.error('Failed to publish doc:', e)
    }
  }

  const getPeers = () => peerCount

  return { publish, getPeers }
}

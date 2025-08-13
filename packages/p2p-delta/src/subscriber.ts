import { createHelia } from 'helia'
import { createLibp2p } from 'libp2p'
import { webSockets } from '@libp2p/websockets'
import { webRTC } from '@libp2p/webrtc'
import { noise } from '@chainsafe/libp2p-noise'
import { mplex } from '@libp2p/mplex'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { identify } from '@libp2p/identify'
import { verify, canon } from 'crypto-verify'
import { db } from 'local-db'
import { addDocs } from 'search-core'

const TOPIC = 'grahmos/updates/v1'

export async function startSubscriber(){
  const libp2p = await createLibp2p({
    transports: [webSockets()],
    connectionEncrypters: [noise()],
    streamMuxers: [mplex()],
    services: {
      pubsub: gossipsub(),
      identify: identify()
    }
  })
  
  const node = await createHelia({ libp2p })

  libp2p.services.pubsub.addEventListener('message', async (event) => {
    if (event.detail.topic !== TOPIC) return
    const msg = event.detail
    try {
      const raw = new TextDecoder().decode(msg.data)
      const delta = JSON.parse(raw)

      const canonMsg = canon({
        id: delta.id,
        title: delta.title,
        url: delta.url,
        summary: delta.summary
      })
      
      const ok = await verify(delta.pubkey, canonMsg, delta.sig)
      if(!ok){
        console.warn('Signature failed for', delta.id)
        return
      }

      await db.docs.put({
        id: delta.id,
        title: delta.title,
        url: delta.url,
        summary: delta.summary
      })

      await addDocs([{ id: delta.id, title: delta.title, url: delta.url, summary: delta.summary }])

      console.log('Delta applied:', delta.id)
    } catch(e){
      console.error('Failed to apply delta:', e)
    }
  })

  await libp2p.services.pubsub.subscribe(TOPIC)
  console.log(`Subscribed to ${TOPIC}`)
  return node
}

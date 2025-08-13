import { createHelia } from 'helia'
import { createLibp2p } from 'libp2p'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { mplex } from '@libp2p/mplex'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { identify } from '@libp2p/identify'
import nacl from 'tweetnacl'
import util from 'tweetnacl-util'

const TOPIC = 'grahmos/updates/v1'

async function run(){
  const keyPair = nacl.sign.keyPair()
  const pubkeyBase64 = util.encodeBase64(keyPair.publicKey)

  const delta = {
    id: 'w_en_4',
    title: 'Emergency Communications',
    url: '/A/Emergency_communications.html',
    summary: 'How to communicate when networks are down.'
  }

  const canonMsg = JSON.stringify(delta, Object.keys(delta).sort())
  const msgBytes = util.decodeUTF8(canonMsg)
  const sig = nacl.sign.detached(msgBytes, keyPair.secretKey)
  const sigBase64 = util.encodeBase64(sig)

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
  const payload = { ...delta, sig: sigBase64, pubkey: pubkeyBase64 }
  
  await libp2p.services.pubsub.publish(TOPIC, util.decodeUTF8(JSON.stringify(payload)))

  console.log('Published delta', payload)
  
  setTimeout(() => process.exit(0), 2000)
}

run().catch(console.error)

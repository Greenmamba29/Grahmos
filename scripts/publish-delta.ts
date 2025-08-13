const { createHelia } = require('helia')
const { createLibp2p } = require('libp2p')
const { webSockets } = require('@libp2p/websockets')
const { noise } = require('@chainsafe/libp2p-noise')
const { mplex } = require('@libp2p/mplex')
const { gossipsub } = require('@chainsafe/libp2p-gossipsub')
const { identify } = require('@libp2p/identify')
const nacl = require('tweetnacl')
const util = require('tweetnacl-util')

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

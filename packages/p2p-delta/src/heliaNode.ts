import { createHelia } from 'helia'
import { createLibp2p } from 'libp2p'
import { webSockets } from '@libp2p/websockets'
import { webRTC } from '@libp2p/webrtc'
import { noise } from '@chainsafe/libp2p-noise'
import { mplex } from '@libp2p/mplex'
export async function startNode(){
  const libp2p = await createLibp2p({ transports:[webSockets(), webRTC()], connectionEncrypters:[noise()], streamMuxers:[mplex()] })
  return await createHelia({ libp2p })
}

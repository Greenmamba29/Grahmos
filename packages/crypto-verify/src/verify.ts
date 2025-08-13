import nacl from 'tweetnacl'
import util from 'tweetnacl-util'

export function verifyBundleSignature(bundle:Uint8Array, sig:Uint8Array, pk:Uint8Array){
  return nacl.sign.detached.verify(bundle, sig, pk)
}

export async function verify(pubkeyBase64: string, message: string, sigBase64: string){
  const pubKey = util.decodeBase64(pubkeyBase64)
  const sig = util.decodeBase64(sigBase64)
  const msg = util.decodeUTF8(message)
  return nacl.sign.detached.verify(msg, sig, pubKey)
}

export function canon(obj: any) {
  return JSON.stringify(obj, Object.keys(obj).sort())
}

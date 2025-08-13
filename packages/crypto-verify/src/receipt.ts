import nacl from 'tweetnacl'
import * as util from 'tweetnacl-util'

export function canon(obj:any){ return JSON.stringify(obj, Object.keys(obj).sort()) }

export function verifyReceipt(pubkeyB64:string, receipt:any, sigB64:string){
  const pk = util.decodeBase64(pubkeyB64)
  const msg = util.decodeUTF8(canon(receipt))
  const sig = util.decodeBase64(sigB64)
  return nacl.sign.detached.verify(msg, sig, pk)
}

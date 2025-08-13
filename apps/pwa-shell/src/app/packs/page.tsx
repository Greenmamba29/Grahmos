'use client'
import { useState } from 'react'
import { parseMinisig, verifyBytesEd25519 } from '../../../../../packages/crypto-verify/src/minisign'
import { db } from '../../../../../packages/local-db/src/db'

export default function PacksPage() {
  const [zimFile, setZimFile] = useState<File | null>(null)
  const [sigFile, setSigFile] = useState<File | null>(null)
  const [pubkey, setPubkey] = useState('')
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleVerifyAndAdd = async () => {
    if (!zimFile || !sigFile || !pubkey.trim()) {
      setStatus('error')
      setMessage('Please select ZIM file, signature file, and enter public key')
      return
    }

    setStatus('verifying')
    try {
      const zimBytes = new Uint8Array(await zimFile.arrayBuffer())
      const sigText = await sigFile.text()
      
      const { keyId, sigB64 } = parseMinisig(sigText)
      
      const isValid = await verifyBytesEd25519(zimBytes, sigB64, pubkey.trim())
      
      if (!isValid) {
        setStatus('error')
        setMessage('Signature verification failed!')
        return
      }

      const hashBuffer = await crypto.subtle.digest('SHA-256', zimBytes)
      const sha256 = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('')

      const pack = {
        id: crypto.randomUUID(),
        name: zimFile.name,
        size: zimFile.size,
        sha256,
        keyId,
        pubkey: pubkey.trim(),
        sigB64,
        installedAt: Date.now(),
        status: 'verified' as const
      }

      await db.contentPacks.add(pack)
      
      setStatus('success')
      setMessage(`Pack "${zimFile.name}" verified and added successfully!`)
      
    } catch (error) {
      setStatus('error')
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">ZIM Pack Import</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">ZIM File</label>
          <input
            type="file"
            accept=".zim"
            onChange={(e) => setZimFile(e.target.files?.[0] || null)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Signature File (.minisig or .sig)</label>
          <input
            type="file"
            accept=".minisig,.sig"
            onChange={(e) => setSigFile(e.target.files?.[0] || null)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Public Key (Base64)</label>
          <textarea
            value={pubkey}
            onChange={(e) => setPubkey(e.target.value)}
            placeholder="Enter Ed25519 public key in Base64 format"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 h-24"
          />
        </div>

        <button
          onClick={handleVerifyAndAdd}
          disabled={status === 'verifying'}
          className={`w-full py-2 px-4 rounded-lg font-medium ${
            status === 'success' ? 'bg-green-700 text-white' :
            status === 'error' ? 'bg-red-700 text-white' :
            'bg-blue-700 hover:bg-blue-600 text-white'
          }`}
        >
          {status === 'verifying' ? 'Verifying...' : 'Verify and Add'}
        </button>

        {message && (
          <div className={`p-3 rounded-lg ${
            status === 'success' ? 'bg-green-900/50 text-green-200' :
            status === 'error' ? 'bg-red-900/50 text-red-200' :
            'bg-neutral-800'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}

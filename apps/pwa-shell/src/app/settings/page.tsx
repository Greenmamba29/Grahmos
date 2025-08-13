'use client'
import { useState, useEffect } from 'react'
import { getSyncPassphrase, setSyncPassphrase } from '../../lib/settings'

export default function SettingsPage() {
  const [passphrase, setPassphrase] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSyncPassphrase().then(setPassphrase)
  }, [])

  const handleSave = async () => {
    await setSyncPassphrase(passphrase)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-neutral-100">Settings</h1>
      
      <div className="bg-neutral-900 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-neutral-200">Peer Sync</h2>
        
        <div className="space-y-2">
          <label htmlFor="passphrase" className="block text-sm font-medium text-neutral-300">
            Sync Passphrase
          </label>
          <input
            id="passphrase"
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter passphrase for encrypted sync"
          />
          <p className="text-xs text-neutral-400">
            This passphrase encrypts all peer-to-peer sync messages. Use the same passphrase on all devices.
          </p>
        </div>
        
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

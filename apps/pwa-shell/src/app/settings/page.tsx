'use client'
import { useState, useEffect } from 'react'
import { getSyncPassphrase, setSyncPassphrase, getBatteryProfile, setBatteryProfile } from '../../lib/settings'
import { applyProfile } from '../../../../../packages/p2p-delta/src/peerSync'

export default function SettingsPage() {
  const [passphrase, setPassphrase] = useState('')
  const [batteryProfile, setBatteryProfileState] = useState<'normal' | 'red' | 'lowPower' | 'auto'>('auto')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSyncPassphrase().then(setPassphrase)
    getBatteryProfile().then(setBatteryProfileState)
  }, [])

  const handleSave = async () => {
    await setSyncPassphrase(passphrase)
    await setBatteryProfile(batteryProfile)
    
    // Apply the profile change immediately
    console.log(`Battery profile changed to: ${batteryProfile}`)
    applyProfile(batteryProfile)
    
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
        
        <div className="space-y-2">
          <label htmlFor="battery-profile" className="block text-sm font-medium text-neutral-300">
            Battery Profile
          </label>
          <select
            id="battery-profile"
            value={batteryProfile}
            onChange={(e) => setBatteryProfileState(e.target.value as 'normal' | 'red' | 'lowPower' | 'auto')}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="auto">Auto - Adapt based on conditions</option>
            <option value="normal">Normal - Publish/heartbeat every 10m</option>
            <option value="red">Red - Every 45s for urgent sync</option>
            <option value="lowPower">Low Power - Every 20m, minimal activity</option>
          </select>
          <p className="text-xs text-neutral-400">
            Controls sync frequency and resource usage. Auto mode adapts based on network conditions, tab visibility, and red mode state.
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

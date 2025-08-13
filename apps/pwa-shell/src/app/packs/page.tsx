'use client'
import { useState, useEffect } from 'react'
import { ContentPack, db } from '../../../../../packages/local-db/src/db'
import { getStorageUsage, removePack, verifyPack, StorageInfo } from '../../lib/storage'

export default function PacksPage() {
  const [packs, setPacks] = useState<ContentPack[]>([])
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({ used: 0 })
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [packsData, storage] = await Promise.all([
        db.contentPacks.toArray(),
        getStorageUsage()
      ])
      setPacks(packsData)
      setStorageInfo(storage)
    } catch (error) {
      console.error('Error loading packs data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemovePack(packId: string) {
    if (!confirm('Are you sure you want to remove this pack? This will delete all associated content and cannot be undone.')) {
      return
    }

    try {
      setRemoving(packId)
      const result = await removePack(packId)
      
      // Show success toast with reindex info
      setToast(`Removed pack and reindexed ${result.docsRemoved} docs.`)
      setTimeout(() => setToast(null), 5000) // Hide toast after 5 seconds
      
      await loadData() // Refresh the data
    } catch (error) {
      console.error('Error removing pack:', error)
      alert('Failed to remove pack. Please try again.')
    } finally {
      setRemoving(null)
    }
  }

  async function handleVerifyPack(packId: string) {
    try {
      setVerifying(packId)
      const result = await verifyPack(packId)
      
      if (result.success) {
        setToast('Pack signature verified successfully ✅')
      } else {
        setToast(`Pack verification failed: ${result.error || 'Unknown error'} ❌`)
      }
      setTimeout(() => setToast(null), 5000)
      
      await loadData() // Refresh the data to show updated verification status
    } catch (error) {
      console.error('Error verifying pack:', error)
      setToast('Failed to verify pack. Please try again. ❌')
      setTimeout(() => setToast(null), 5000)
    } finally {
      setVerifying(null)
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 MB'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Content Packs</h1>
        <div className="text-neutral-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Content Packs</h1>
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 bg-green-900/90 border border-green-700 rounded-lg p-4 shadow-lg z-50">
          <div className="flex items-center">
            <div className="text-green-200 text-sm">{toast}</div>
            <button 
              onClick={() => setToast(null)}
              className="ml-3 text-green-300 hover:text-green-100 transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Storage Usage Banner */}
      <div data-testid="storage-usage" className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-white">Storage Usage</h2>
            <p className="text-sm text-neutral-400">
              Used: <span className="font-mono">{formatBytes(storageInfo.used)}</span>
              {storageInfo.quota && (
                <>
                  {' '} of <span className="font-mono">{formatBytes(storageInfo.quota)}</span>
                  {' '}({((storageInfo.used / storageInfo.quota) * 100).toFixed(1)}%)
                </>
              )}
            </p>
          </div>
          {storageInfo.quota && (
            <div className="w-32 h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${Math.min((storageInfo.used / storageInfo.quota) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Packs Table */}
      {packs.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 text-center">
          <div className="text-neutral-400 mb-2">No content packs installed</div>
          <p className="text-sm text-neutral-500">
            Install content packs to access offline articles and resources.
          </p>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">
                    Installed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">
                    Verified
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {packs.map((pack) => (
                  <tr key={pack.id} className="hover:bg-neutral-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white">{pack.name}</div>
                      <div className="text-xs text-neutral-400 font-mono">{pack.id}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-300">
                      {formatBytes(pack.size)}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-300">
                      {formatDate(pack.installedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        pack.status === 'installed' 
                          ? 'bg-green-900/20 text-green-200 border border-green-700/30'
                          : pack.status === 'installing'
                          ? 'bg-yellow-900/20 text-yellow-200 border border-yellow-700/30'
                          : 'bg-red-900/20 text-red-200 border border-red-700/30'
                      }`}>
                        {pack.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span data-testid="pack-verified" className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            !pack.sigB64 
                              ? 'bg-amber-900/20 text-amber-200 border border-amber-700/30'
                              : pack.verificationStatus === 'valid'
                              ? 'bg-green-900/20 text-green-200 border border-green-700/30'
                              : pack.verificationStatus === 'invalid'
                              ? 'bg-red-900/20 text-red-200 border border-red-700/30'
                              : 'bg-blue-900/20 text-blue-200 border border-blue-700/30'
                          }`}>
                            {!pack.sigB64 
                              ? '⚠ Unsigned' 
                              : pack.verificationStatus === 'valid'
                              ? '✅ Valid'
                              : pack.verificationStatus === 'invalid'
                              ? '❌ Invalid'
                              : '✓ Signed'
                            }
                          </span>
                        </div>
                        {pack.sigB64 && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleVerifyPack(pack.id)}
                              disabled={verifying === pack.id}
                              className="inline-flex items-center px-2 py-1 border border-blue-700/30 text-xs font-medium rounded text-blue-200 bg-blue-900/20 hover:bg-blue-900/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {verifying === pack.id ? 'Verifying...' : 'Verify now'}
                            </button>
                            {pack.verifiedAt && (
                              <span className="text-xs text-neutral-500">
                                {formatDate(pack.verifiedAt)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        data-testid="remove-pack-button"
                        onClick={() => handleRemovePack(pack.id)}
                        disabled={removing === pack.id}
                        className="inline-flex items-center px-3 py-1.5 border border-red-700/30 text-xs font-medium rounded text-red-200 bg-red-900/20 hover:bg-red-900/40 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {removing === pack.id ? 'Removing...' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

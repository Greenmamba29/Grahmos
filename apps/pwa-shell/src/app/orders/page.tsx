'use client'
import { useState, useEffect } from 'react'
import { db, Receipt } from '../../../../../packages/local-db/src/db'
import { verifyReceiptByKey } from '../../../../../packages/crypto-verify/src/receipt'

type FilterType = 'all' | 'verified' | 'invalid' | 'pending'
type ReceiptWithStatus = Receipt & { verificationStatus?: 'verified' | 'invalid' | 'pending' }

export default function OrdersPage() {
  const [receipts, setReceipts] = useState<ReceiptWithStatus[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [pubkeys, setPubkeys] = useState<Record<string, string>>({})

  useEffect(() => {
    loadReceipts()
    fetchCurrentPubkey()
  }, [])

  const fetchCurrentPubkey = async () => {
    try {
      const response = await fetch('/api/worker/pubkey')
      if (response.ok) {
        const data = await response.json()
        setPubkeys(prev => ({
          ...prev,
          [data.keyId]: data.pubkey
        }))
      }
    } catch (error) {
      console.error('Failed to fetch current pubkey:', error)
    }
  }

  const loadReceipts = async () => {
    try {
      setLoading(true)
      const receiptData = await db.receipts.orderBy('ts').reverse().toArray()
      setReceipts(receiptData.map(r => ({ ...r, verificationStatus: r.status || 'pending' })))
    } catch (error) {
      console.error('Failed to load receipts:', error)
    } finally {
      setLoading(false)
    }
  }

  const verifyReceipt = async (receipt: ReceiptWithStatus) => {
    if (!receipt.payload || !receipt.sig) return

    setVerifying(receipt.id)
    
    try {
      // Key resolver function
      const keyById = (keyId: string) => {
        return pubkeys[keyId] || null
      }

      const isValid = verifyReceiptByKey(receipt.payload, receipt.sig, keyById)
      const newStatus = isValid ? 'verified' : 'invalid'
      
      // Update in database
      await db.receipts.update(receipt.id, { status: newStatus })
      
      // Update local state
      setReceipts(prev => prev.map(r => 
        r.id === receipt.id 
          ? { ...r, verificationStatus: newStatus, status: newStatus }
          : r
      ))
    } catch (error) {
      console.error('Verification failed:', error)
      // Update status to invalid on error
      await db.receipts.update(receipt.id, { status: 'invalid' })
      setReceipts(prev => prev.map(r => 
        r.id === receipt.id 
          ? { ...r, verificationStatus: 'invalid', status: 'invalid' }
          : r
      ))
    } finally {
      setVerifying(null)
    }
  }

  const downloadReceipt = (receipt: ReceiptWithStatus) => {
    const data = {
      receipt: receipt.payload,
      signature: receipt.sig,
      keyId: receipt.keyId || 'unknown',
      timestamp: receipt.ts,
      verificationStatus: receipt.verificationStatus
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `receipt_${receipt.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getStatusChip = (status: 'verified' | 'invalid' | 'pending') => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    
    switch (status) {
      case 'verified':
        return `${baseClasses} bg-green-900/20 text-green-200 border border-green-700/30`
      case 'invalid':
        return `${baseClasses} bg-red-900/20 text-red-200 border border-red-700/30`
      case 'pending':
        return `${baseClasses} bg-yellow-900/20 text-yellow-200 border border-yellow-700/30`
      default:
        return `${baseClasses} bg-gray-900/20 text-gray-200 border border-gray-700/30`
    }
  }

  const getStatusIcon = (status: 'verified' | 'invalid' | 'pending') => {
    switch (status) {
      case 'verified': return '✅'
      case 'invalid': return '❌'  
      case 'pending': return '⏳'
      default: return '❓'
    }
  }

  const filteredReceipts = receipts.filter(receipt => {
    if (filter === 'all') return true
    return receipt.verificationStatus === filter
  })

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString() + ' ' + new Date(timestamp).toLocaleTimeString()
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100) // Assuming amounts are in cents
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Orders</h1>
        <div className="text-neutral-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Orders</h1>
      
      {/* Filter Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-4">
          {(['all', 'verified', 'invalid', 'pending'] as FilterType[]).map(filterType => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`px-3 py-2 text-sm rounded-md transition-colors capitalize ${
                filter === filterType
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
              }`}
            >
              {filterType} ({receipts.filter(r => filterType === 'all' || r.verificationStatus === filterType).length})
            </button>
          ))}
        </nav>
      </div>

      {/* Receipts Table */}
      {filteredReceipts.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 text-center">
          <div className="text-neutral-400 mb-2">No orders found</div>
          <p className="text-sm text-neutral-500">
            {filter === 'all' ? 'No orders have been placed yet.' : `No ${filter} orders found.`}
          </p>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">
                    Key ID
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filteredReceipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-neutral-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white">{receipt.payload?.orderId || receipt.id}</div>
                      <div className="text-xs text-neutral-400 font-mono">{receipt.intentId}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-300">
                      {receipt.payload?.itemId || 'Unknown Item'}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-300">
                      {receipt.payload?.amount && receipt.payload?.currency
                        ? formatCurrency(receipt.payload.amount, receipt.payload.currency)
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-300">
                      {formatDate(receipt.ts)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={getStatusChip(receipt.verificationStatus || 'pending')}>
                        {getStatusIcon(receipt.verificationStatus || 'pending')} {receipt.verificationStatus || 'pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-neutral-400">
                      {receipt.keyId || receipt.payload?.keyId || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => verifyReceipt(receipt)}
                        disabled={verifying === receipt.id}
                        className="inline-flex items-center px-3 py-1.5 border border-blue-700/30 text-xs font-medium rounded text-blue-200 bg-blue-900/20 hover:bg-blue-900/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {verifying === receipt.id ? 'Verifying...' : 'Verify'}
                      </button>
                      <button
                        onClick={() => downloadReceipt(receipt)}
                        className="inline-flex items-center px-3 py-1.5 border border-green-700/30 text-xs font-medium rounded text-green-200 bg-green-900/20 hover:bg-green-900/40 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-neutral-900 transition-colors"
                      >
                        Download JSON
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

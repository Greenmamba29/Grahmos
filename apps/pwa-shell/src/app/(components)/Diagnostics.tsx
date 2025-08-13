'use client'
import { useState, useEffect } from 'react'

interface DiagnosticsProps {
  getPeers?: () => number
  lastMessageTime?: number
}

export default function Diagnostics({ getPeers, lastMessageTime }: DiagnosticsProps) {
  const [peers, setPeers] = useState(0)
  const [lastMsg, setLastMsg] = useState<number | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      if (getPeers) {
        setPeers(getPeers())
      }
      if (lastMessageTime) {
        setLastMsg(lastMessageTime)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [getPeers, lastMessageTime])

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return 'never'
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  return (
    <div className="text-xs text-neutral-400 flex items-center gap-3">
      <span>peers: {peers}</span>
      <span>last msg: {formatTimeAgo(lastMsg)}</span>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'

interface DiagnosticsProps {
  getPeers?: () => number
  lastMessageTime?: number
  getDiagnostics?: () => {
    signaling: "ok" | "none" | "error"
    lastHeartbeat: number | null
    connectedPeers: number
    cadence?: string
    oversizedMessagesBlocked?: number
    batteryProfile?: 'normal' | 'red' | 'lowPower' | 'auto'
    effectiveCadenceMs?: number
  }
}

export default function Diagnostics({ getPeers, lastMessageTime, getDiagnostics }: DiagnosticsProps) {
  const [peers, setPeers] = useState(0)
  const [lastMsg, setLastMsg] = useState<number | null>(null)
  const [signaling, setSignaling] = useState<"ok" | "none" | "error">("none")
  const [lastHeartbeat, setLastHeartbeat] = useState<number | null>(null)
  const [cadence, setCadence] = useState<string>("10m (normal)")
  const [oversizedBlocked, setOversizedBlocked] = useState(0)
  const [batteryProfile, setBatteryProfile] = useState<'normal' | 'red' | 'lowPower' | 'auto'>('auto')
  const [effectiveCadenceMs, setEffectiveCadenceMs] = useState<number>(600000)

  useEffect(() => {
    const interval = setInterval(() => {
      if (getPeers) {
        setPeers(getPeers())
      }
      if (lastMessageTime) {
        setLastMsg(lastMessageTime)
      }
      if (getDiagnostics) {
        try {
          const diag = getDiagnostics()
          setSignaling(diag.signaling)
          setLastHeartbeat(diag.lastHeartbeat)
          if (diag.cadence) {
            setCadence(diag.cadence)
          }
          if (diag.oversizedMessagesBlocked !== undefined) {
            setOversizedBlocked(diag.oversizedMessagesBlocked)
          }
          if (diag.batteryProfile) {
            setBatteryProfile(diag.batteryProfile)
          }
          if (diag.effectiveCadenceMs) {
            setEffectiveCadenceMs(diag.effectiveCadenceMs)
          }
        } catch {
          // Diagnostics not yet available
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [getPeers, lastMessageTime, getDiagnostics])

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return 'never'
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  const getSignalingColor = (status: "ok" | "none" | "error") => {
    switch (status) {
      case "ok": return "text-green-400"
      case "none": return "text-yellow-400"
      case "error": return "text-red-400"
    }
  }

  const getSignalingText = (status: "ok" | "none" | "error") => {
    switch (status) {
      case "ok": return "signaling"
      case "none": return "no signaling"
      case "error": return "sig error"
    }
  }

  return (
    <div className="text-xs text-neutral-400 space-y-1">
      <div className="flex items-center gap-3">
        <span>peers: {peers}</span>
        <span className={getSignalingColor(signaling)}>{getSignalingText(signaling)}</span>
        <span>cadence: {cadence}</span>
        <span>profile: {batteryProfile}</span>
        <span>last msg: {formatTimeAgo(lastMsg)}</span>
        <span>heartbeat: {formatTimeAgo(lastHeartbeat)}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-neutral-500">
          cadence: 45s (red), 10m (normal), 20m (lowPower) | effective: {Math.round(effectiveCadenceMs / 1000)}s
        </div>
        {oversizedBlocked > 0 && (
          <div className="text-amber-400 text-xs">
            ⚠ {oversizedBlocked} oversized messages blocked
          </div>
        )}
      </div>
    </div>
  )
}

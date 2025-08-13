'use client'
import React, { useEffect } from 'react'
import { useRegisterSW } from '../app/sw-client'

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  useRegisterSW()
  
  useEffect(() => {
    const startDeltaSubscriber = async () => {
      try {
        const { startSubscriber } = await import('../../../../packages/p2p-delta/src/subscriber')
        await startSubscriber()
      } catch (e) {
        console.error('Failed to start delta subscriber:', e)
      }
    }
    startDeltaSubscriber()
  }, [])
  
  return <>{children}</>
}

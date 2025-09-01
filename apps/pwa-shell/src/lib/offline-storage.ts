'use client'

// Simple offline storage utilities for enhanced PWA capabilities

export const getNetworkInfo = () => {
  if (typeof window === 'undefined') {
    return { online: false, connection: 'offline' }
  }

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
  
  return {
    online: navigator.onLine,
    connection: connection ? {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    } : null
  }
}

// Simple localStorage wrapper with error handling
export const offlineStorage = {
  set(key: string, data: any): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(`grahmos-${key}`, JSON.stringify(data))
      } catch (error) {
        console.warn('Failed to store data offline:', error)
      }
    }
  },
  
  get(key: string, defaultValue: any = null): any {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem(`grahmos-${key}`)
        return stored ? JSON.parse(stored) : defaultValue
      } catch (error) {
        console.warn('Failed to retrieve offline data:', error)
        return defaultValue
      }
    }
    return defaultValue
  },
  
  remove(key: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(`grahmos-${key}`)
      } catch (error) {
        console.warn('Failed to remove offline data:', error)
      }
    }
  }
}

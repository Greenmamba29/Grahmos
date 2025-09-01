'use client'

// Offline storage utilities for enhanced PWA capabilities

interface StorageConfig {
  name: string
  version: number
}

class OfflineStorage {
  private db: IDBDatabase | null = null
  private readonly dbName: string
  private readonly version: number

  constructor(config: StorageConfig) {
    this.dbName = config.name
    this.version = config.version
  }

  async init(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB not available, falling back to localStorage')
      return
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        console.log(`📦 Offline storage initialized: ${this.dbName}`)
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Search index store
        if (!db.objectStoreNames.contains('search-index')) {
          const searchStore = db.createObjectStore('search-index', { keyPath: 'id' })
          searchStore.createIndex('terms', 'terms', { multiEntry: true })
          searchStore.createIndex('category', 'category', { unique: false })
          searchStore.createIndex('priority', 'priority', { unique: false })
        }

        // Chat history store
        if (!db.objectStoreNames.contains('chat-history')) {
          const chatStore = db.createObjectStore('chat-history', { keyPath: 'id' })
          chatStore.createIndex('timestamp', 'timestamp', { unique: false })
          chatStore.createIndex('role', 'role', { unique: false })
        }

        // Emergency data cache
        if (!db.objectStoreNames.contains('emergency-cache')) {
          const emergencyStore = db.createObjectStore('emergency-cache', { keyPath: 'key' })
          emergencyStore.createIndex('type', 'type', { unique: false })
          emergencyStore.createIndex('lastUpdated', 'lastUpdated', { unique: false })
        }

        // User preferences
        if (!db.objectStoreNames.contains('user-preferences')) {
          db.createObjectStore('user-preferences', { keyPath: 'key' })
        }
      }
    })
  }

  // Search index operations
  async storeSearchDocs(docs: any[]): Promise<void> {
    if (!this.db) return this.fallbackToLocalStorage('search-docs', docs)

    const transaction = this.db.transaction(['search-index'], 'readwrite')
    const store = transaction.objectStore('search-index')

    for (const doc of docs) {
      await store.put({
        ...doc,
        terms: this.extractSearchTerms(doc),
        cachedAt: Date.now()
      })
    }
  }

  async getSearchDocs(): Promise<any[]> {
    if (!this.db) return this.fallbackFromLocalStorage('search-docs', [])

    const transaction = this.db.transaction(['search-index'], 'readonly')
    const store = transaction.objectStore('search-index')
    
    return new Promise((resolve) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => resolve([])
    })
  }

  // Chat history operations
  async storeChatMessage(message: any): Promise<void> {
    if (!this.db) return this.fallbackToLocalStorage('chat-history', [message])

    const transaction = this.db.transaction(['chat-history'], 'readwrite')
    const store = transaction.objectStore('chat-history')
    
    await store.put({
      ...message,
      timestamp: Date.now()
    })
  }

  async getChatHistory(limit = 50): Promise<any[]> {
    if (!this.db) return this.fallbackFromLocalStorage('chat-history', [])

    const transaction = this.db.transaction(['chat-history'], 'readonly')
    const store = transaction.objectStore('chat-history')
    const index = store.index('timestamp')
    
    return new Promise((resolve) => {
      const request = index.getAll(null, limit)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => resolve([])
    })
  }

  // Emergency data caching
  async cacheEmergencyData(key: string, data: any, type = 'general'): Promise<void> {
    if (!this.db) return this.fallbackToLocalStorage(`emergency-${key}`, data)

    const transaction = this.db.transaction(['emergency-cache'], 'readwrite')
    const store = transaction.objectStore('emergency-cache')
    
    await store.put({
      key,
      data,
      type,
      lastUpdated: Date.now()
    })
  }

  async getEmergencyData(key: string): Promise<any> {
    if (!this.db) return this.fallbackFromLocalStorage(`emergency-${key}`, null)

    const transaction = this.db.transaction(['emergency-cache'], 'readonly')
    const store = transaction.objectStore('emergency-cache')
    
    return new Promise((resolve) => {
      const request = store.get(key)
      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.data : null)
      }
      request.onerror = () => resolve(null)
    })
  }

  // User preferences
  async setPreference(key: string, value: any): Promise<void> {
    if (!this.db) return this.fallbackToLocalStorage(`pref-${key}`, value)

    const transaction = this.db.transaction(['user-preferences'], 'readwrite')
    const store = transaction.objectStore('user-preferences')
    
    await store.put({ key, value, updatedAt: Date.now() })
  }

  async getPreference(key: string, defaultValue: any = null): Promise<any> {
    if (!this.db) return this.fallbackFromLocalStorage(`pref-${key}`, defaultValue)

    const transaction = this.db.transaction(['user-preferences'], 'readonly')
    const store = transaction.objectStore('user-preferences')
    
    return new Promise((resolve) => {
      const request = store.get(key)
      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.value : defaultValue)
      }
      request.onerror = () => resolve(defaultValue)
    })
  }

  // Storage statistics
  async getStorageStats(): Promise<{
    searchDocs: number
    chatMessages: number
    emergencyCache: number
    preferences: number
  }> {
    if (!this.db) {
      return {
        searchDocs: this.getLocalStorageCount('search-docs'),
        chatMessages: this.getLocalStorageCount('chat-history'),
        emergencyCache: this.getLocalStorageCount('emergency-'),
        preferences: this.getLocalStorageCount('pref-')
      }
    }

    const stats = {
      searchDocs: await this.getStoreCount('search-index'),
      chatMessages: await this.getStoreCount('chat-history'),
      emergencyCache: await this.getStoreCount('emergency-cache'),
      preferences: await this.getStoreCount('user-preferences')
    }

    return stats
  }

  // Clear storage
  async clearAllData(): Promise<void> {
    if (!this.db) {
      // Clear localStorage fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('grahmos-')) {
            localStorage.removeItem(key)
          }
        })
      }
      return
    }

    const transaction = this.db.transaction(
      ['search-index', 'chat-history', 'emergency-cache', 'user-preferences'],
      'readwrite'
    )
    
    await Promise.all([
      transaction.objectStore('search-index').clear(),
      transaction.objectStore('chat-history').clear(),
      transaction.objectStore('emergency-cache').clear(),
      transaction.objectStore('user-preferences').clear()
    ])

    console.log('🗑️ All offline data cleared')
  }

  // Private helper methods
  private extractSearchTerms(doc: any): string[] {
    const text = [
      doc.title || '',
      doc.summary || '',
      doc.content || '',
      ...(doc.keywords || []),
      doc.category || ''
    ].join(' ')

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2)
  }

  private async getStoreCount(storeName: string): Promise<number> {
    if (!this.db) return 0

    const transaction = this.db.transaction([storeName], 'readonly')
    const store = transaction.objectStore('search-index')
    
    return new Promise((resolve) => {
      const request = store.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(0)
    })
  }

  private fallbackToLocalStorage(key: string, data: any): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(`grahmos-${key}`, JSON.stringify(data))
    }
  }

  private fallbackFromLocalStorage(key: string, defaultValue: any): any {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(`grahmos-${key}`)
      return stored ? JSON.parse(stored) : defaultValue
    }
    return defaultValue
  }

  private getLocalStorageCount(prefix: string): number {
    if (typeof window === 'undefined' || !window.localStorage) return 0
    
    return Object.keys(localStorage).filter(key => 
      key.startsWith(`grahmos-${prefix}`)
    ).length
  }
}

// Create global instance
export const offlineStorage = new OfflineStorage({
  name: 'grahmos-offline-db',
  version: 1
})

// Utility functions for common operations
export const initOfflineStorage = () => offlineStorage.init()

export const cacheForOffline = async (key: string, data: any) => {
  await offlineStorage.cacheEmergencyData(key, data)
}

export const getOfflineData = async (key: string) => {
  return await offlineStorage.getEmergencyData(key)
}

export const getStorageInfo = async () => {
  return await offlineStorage.getStorageStats()
}

// Network status detection
export const getNetworkInfo = () => {
  if (typeof window === 'undefined' || !navigator.onLine) {
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

// Background sync registration (when available)
export const scheduleBackgroundSync = async (tag: string) => {
  if (typeof window === 'undefined') return

  try {
    const registration = await navigator.serviceWorker.ready
    if ('sync' in registration) {
      await (registration as any).sync.register(tag)
      console.log(`🔄 Background sync scheduled: ${tag}`)
    }
  } catch (error) {
    console.warn('Background sync not supported:', error)
  }
}

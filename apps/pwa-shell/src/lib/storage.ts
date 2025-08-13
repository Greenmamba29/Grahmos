import { db } from '../../../../packages/local-db/src/db'
import * as Search from '../../../../packages/search-core/src'
import { verify } from '../../../../packages/crypto-verify/src/verify'

export interface StorageInfo {
  used: number
  quota?: number
}

export async function getStorageUsage(): Promise<StorageInfo> {
  try {
    // Try modern navigator.storage.estimate() first
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate()
      return {
        used: estimate.usage || 0,
        quota: estimate.quota
      }
    }
    
    // Fallback: estimate IndexedDB + cache sizes
    let totalSize = 0
    
    try {
      // Try to estimate IndexedDB usage (rough estimate)
      const allDocs = await db.docs.toArray()
      const allPacks = await db.contentPacks.toArray()
      
      // Rough estimation: 1KB per doc + pack sizes
      totalSize += allDocs.length * 1024
      totalSize += allPacks.reduce((sum, pack) => sum + (pack.size || 0), 0)
      
      // Try to get cache storage size (best effort approximation)
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        for (const name of cacheNames) {
          const cache = await caches.open(name)
          const requests = await cache.keys()
          
          // Better size estimation based on cache type
          let avgSizePerItem = 2048 // default
          if (name.includes('html')) {
            avgSizePerItem = 15 * 1024 // 15KB per HTML page
          } else if (name.includes('assets')) {
            avgSizePerItem = 50 * 1024 // 50KB per asset (images, CSS, JS)
          } else if (name.includes('pmtiles')) {
            avgSizePerItem = 256 * 1024 // 256KB per tile
          }
          
          totalSize += requests.length * avgSizePerItem
        }
      }
      
    } catch (e) {
      console.warn('Failed to estimate storage usage:', e)
    }
    
    return {
      used: totalSize,
      quota: undefined
    }
  } catch (error) {
    console.error('Error getting storage usage:', error)
    return { used: 0 }
  }
}

export async function removePack(id: string): Promise<{ docsRemoved: number }> {
  try {
    console.log(`Removing pack: ${id}`)
    
    // Get pack details before deletion for cleanup
    const pack = await db.contentPacks.get(id)
    if (!pack) {
      throw new Error(`Pack ${id} not found`)
    }
    
    // a) Delete pack row from Dexie.contentPacks
    await db.contentPacks.delete(id)
    console.log(`Deleted pack ${id} from contentPacks`)
    
    // b) Delete associated docs from Dexie.docs where doc.packId === id
    const docsToDelete = await db.docs.where('packId').equals(id).toArray()
    await db.docs.where('packId').equals(id).delete()
    console.log(`Deleted ${docsToDelete.length} docs associated with pack ${id}`)
    
    // c) Evict cached URLs from Workbox caches
    await evictPackCaches(id, pack.name)
    console.log(`Evicted cached content for pack ${id}`)
    
    // d) Delete OPFS files if present
    await deleteOPFSFiles(pack)
    console.log(`Cleaned up OPFS files for pack ${id}`)
    
    // e) Trigger reindex of remaining docs (synchronous)
    const remainingCount = await reindexRemainingDocs()
    console.log(`Reindexed ${remainingCount} remaining docs after removing pack ${id}`)
    
    return { docsRemoved: docsToDelete.length }
    
  } catch (error) {
    console.error(`Error removing pack ${id}:`, error)
    throw error
  }
}

async function evictPackCaches(packId: string, packName: string): Promise<void> {
  try {
    if (!('caches' in window)) {
      console.warn('Cache API not available')
      return
    }

    const cacheNames = await caches.keys()
    let evictedCount = 0

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName)
      const requests = await cache.keys()

      for (const request of requests) {
        const url = new URL(request.url)
        // Check if this is a kiwix API request for this pack
        if (url.pathname === '/api/kiwix' && url.searchParams.has('path')) {
          const path = url.searchParams.get('path')
          // Pack prefix matching logic - adjust based on your pack structure
          if (path && (path.includes(packId) || path.includes(packName))) {
            await cache.delete(request)
            evictedCount++
          }
        }
      }
    }

    console.log(`Evicted ${evictedCount} cached entries for pack ${packId}`)
  } catch (error) {
    console.error('Error evicting pack caches:', error)
  }
}

async function deleteOPFSFiles(pack: { id: string; opfsPath?: string; opfsHandle?: unknown }): Promise<void> {
  try {
    // Check if OPFS is available and pack has OPFS data
    if (!('navigator' in window) || !navigator.storage?.getDirectory) {
      return
    }

    // If pack has OPFS handle/path, delete it
    if (pack.opfsPath || pack.opfsHandle) {
      const opfsRoot = await navigator.storage.getDirectory()
      
      if (pack.opfsPath) {
        try {
          await opfsRoot.removeEntry(pack.opfsPath, { recursive: true })
          console.log(`Deleted OPFS path: ${pack.opfsPath}`)
        } catch {
          console.warn(`Failed to delete OPFS path ${pack.opfsPath}`)
        }
      }
      
      // Clean up any pack-specific OPFS directories
      const packDirName = `pack-${pack.id}`
      try {
        await opfsRoot.removeEntry(packDirName, { recursive: true })
        console.log(`Deleted OPFS directory: ${packDirName}`)
      } catch {
        // Directory may not exist, that's ok
        console.debug(`OPFS directory ${packDirName} not found or already deleted`)
      }
    }
  } catch (error) {
    console.error('Error deleting OPFS files:', error)
  }
}

export async function verifyPack(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Verifying pack: ${id}`)
    
    const pack = await db.contentPacks.get(id)
    if (!pack) {
      return { success: false, error: 'Pack not found' }
    }
    
    if (!pack.sigB64) {
      return { success: false, error: 'Pack has no signature' }
    }
    
    if (!pack.pubkey) {
      return { success: false, error: 'Pack has no public key' }
    }
    
    // Create verification payload (pack metadata for signature)
    const verificationPayload = {
      id: pack.id,
      name: pack.name,
      size: pack.size,
      // Add other relevant fields that should be covered by signature
    }
    
    // Verify signature using minisign-compatible verification
    const isValid = await verify(pack.pubkey, JSON.stringify(verificationPayload), pack.sigB64)
    
    if (isValid) {
      // Update verification timestamp
      await db.contentPacks.update(id, { 
        verifiedAt: Date.now(),
        verificationStatus: 'valid'
      })
      console.log(`Pack ${id} signature verified successfully`)
      return { success: true }
    } else {
      await db.contentPacks.update(id, { 
        verificationStatus: 'invalid'
      })
      console.log(`Pack ${id} signature verification failed`)
      return { success: false, error: 'Signature verification failed' }
    }
    
  } catch (error) {
    console.error(`Error verifying pack ${id}:`, error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function reindexRemainingDocs(): Promise<number> {
  try {
    // Get all remaining docs
    const remainingDocs = await db.docs.toArray()
    console.log(`Reindexing ${remainingDocs.length} remaining docs`)
    
    // Clear and rebuild the search index
    await Search.initIndex()
    
    if (remainingDocs.length > 0) {
      await Search.addDocs(remainingDocs)
    }
    
    console.log('Reindexing completed successfully')
    return remainingDocs.length
  } catch (error) {
    console.error('Error during reindexing:', error)
    throw error
  }
}

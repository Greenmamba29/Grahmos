export async function getSyncInterval(): Promise<number> {
  try {
    const stored = localStorage.getItem('grahmos-settings')
    if (stored) {
      const settings = JSON.parse(stored)
      if (settings.redMode) {
        return 45 * 1000
      }
    }
  } catch (e) {
    console.warn('Failed to load settings for sync interval:', e)
  }
  return 10 * 60 * 1000
}

let syncIntervalId: NodeJS.Timeout | null = null

export async function startSyncLoop() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId)
  }
  
  const interval = await getSyncInterval()
  console.log(`Starting sync loop with ${interval/1000}s interval`)
  
  syncIntervalId = setInterval(async () => {
    console.log('P2P sync tick')
  }, interval)
}

export function stopSyncLoop() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId)
    syncIntervalId = null
  }
}

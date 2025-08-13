export interface AppSettings {
  redMode: boolean
  syncPassphrase: string
  batteryProfile: 'normal' | 'red' | 'lowPower' | 'auto'
}

const DEFAULT_SETTINGS: AppSettings = {
  redMode: false,
  syncPassphrase: '',
  batteryProfile: 'auto'
}

export async function getAppSettings(): Promise<AppSettings> {
  try {
    const stored = localStorage.getItem('grahmos-settings')
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
    }
  } catch (e) {
    console.warn('Failed to load settings:', e)
  }
  return DEFAULT_SETTINGS
}

export async function setAppSettings(settings: Partial<AppSettings>): Promise<void> {
  const current = await getAppSettings()
  const updated = { ...current, ...settings }
  localStorage.setItem('grahmos-settings', JSON.stringify(updated))
}

export async function getSyncPassphrase(): Promise<string> {
  const settings = await getAppSettings()
  return settings.syncPassphrase
}

export async function setSyncPassphrase(passphrase: string): Promise<void> {
  await setAppSettings({ syncPassphrase: passphrase })
}

export async function getBatteryProfile(): Promise<'normal' | 'red' | 'lowPower' | 'auto'> {
  const settings = await getAppSettings()
  return settings.batteryProfile
}

export async function setBatteryProfile(profile: 'normal' | 'red' | 'lowPower' | 'auto'): Promise<void> {
  await setAppSettings({ batteryProfile: profile })
}

export async function getAutoBatteryProfile(redMode?: boolean): Promise<'normal' | 'red' | 'lowPower'> {
  // Check saveData hint
  const connection = (navigator as { connection?: { saveData?: boolean } }).connection
  if (connection?.saveData === true) {
    return 'lowPower'
  }
  
  // Check if tab is hidden
  if (document.hidden === true) {
    return 'lowPower'
  }
  
  // Check current red mode state
  let isRedMode = redMode
  if (isRedMode === undefined) {
    const settings = await getAppSettings()
    isRedMode = settings.redMode
  }
  
  if (isRedMode === true) {
    return 'red'
  }
  
  return 'normal'
}

export interface AppSettings {
  redMode: boolean
  syncPassphrase: string
}

const DEFAULT_SETTINGS: AppSettings = {
  redMode: false,
  syncPassphrase: ''
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

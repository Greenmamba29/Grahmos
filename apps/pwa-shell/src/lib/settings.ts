import { db } from '../../../../../packages/local-db/src/db'

export interface AppSettings {
  redMode: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  redMode: false
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

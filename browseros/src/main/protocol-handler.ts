import { app, BrowserWindow, dialog, shell } from 'electron'
import { URL } from 'url'
import path from 'path'

// GrahmOS Configuration
const GRAHMOS_CONFIG = {
  pwa: {
    url: process.env.GRAHMOS_PWA_URL || 'https://grahmos.localhost:3000',
    fallback: 'http://localhost:3000'
  },
  edge: {
    url: process.env.GRAHMOS_EDGE_URL || 'https://grahmos.localhost:8787',
    fallback: 'http://localhost:8787'
  }
}

// Protocol scheme
const PROTOCOL_SCHEME = 'grahmos'

// Valid protocol actions
const PROTOCOL_ACTIONS = {
  search: 'search',
  emergency: 'emergency', 
  mapping: 'mapping',
  network: 'network',
  settings: 'settings',
  launch: 'launch'
} as const

type ProtocolAction = keyof typeof PROTOCOL_ACTIONS

export class GrahmosProtocolHandler {
  private mainWindow: BrowserWindow | null = null

  constructor() {
    this.setupProtocol()
  }

  /**
   * Initialize protocol handling
   */
  private setupProtocol(): void {
    // Register protocol on app startup
    app.whenReady().then(() => {
      this.registerProtocolHandler()
    })

    // Handle protocol URLs when app is already running
    app.on('open-url', (event, url) => {
      event.preventDefault()
      this.handleProtocolUrl(url)
    })

    // Handle protocol URLs on Windows/Linux
    app.on('second-instance', (event, commandLine) => {
      const protocolUrl = commandLine.find(arg => arg.startsWith(`${PROTOCOL_SCHEME}://`))
      if (protocolUrl) {
        this.handleProtocolUrl(protocolUrl)
      }
      
      // Focus main window if it exists
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore()
        this.mainWindow.focus()
      }
    })
  }

  /**
   * Register as default protocol handler
   */
  private registerProtocolHandler(): void {
    // Set as default protocol client
    if (!app.isDefaultProtocolClient(PROTOCOL_SCHEME)) {
      const success = app.setAsDefaultProtocolClient(PROTOCOL_SCHEME)
      if (success) {
        console.log(`✅ Registered as default handler for ${PROTOCOL_SCHEME}:// protocol`)
      } else {
        console.warn(`⚠️ Failed to register as default handler for ${PROTOCOL_SCHEME}:// protocol`)
      }
    }
  }

  /**
   * Handle incoming protocol URL
   */
  public async handleProtocolUrl(protocolUrl: string): Promise<void> {
    try {
      console.log('📥 Handling protocol URL:', protocolUrl)

      const parsedUrl = new URL(protocolUrl)
      if (parsedUrl.protocol !== `${PROTOCOL_SCHEME}:`) {
        throw new Error(`Invalid protocol: ${parsedUrl.protocol}`)
      }

      const action = parsedUrl.hostname as ProtocolAction
      const params = new URLSearchParams(parsedUrl.search)

      // Validate action
      if (!Object.keys(PROTOCOL_ACTIONS).includes(action)) {
        throw new Error(`Unknown action: ${action}`)
      }

      // Get or create main window
      const window = await this.getOrCreateMainWindow()

      // Route to appropriate handler
      switch (action) {
        case 'search':
          await this.handleSearchAction(window, params)
          break

        case 'emergency':
          await this.handleEmergencyAction(window, params)
          break

        case 'mapping':
          await this.handleMappingAction(window, params)
          break

        case 'network':
          await this.handleNetworkAction(window, params)
          break

        case 'settings':
          await this.handleSettingsAction(window, params)
          break

        case 'launch':
        default:
          await this.handleLaunchAction(window, params)
          break
      }

      // Bring window to front
      window.show()
      window.focus()

    } catch (error) {
      console.error('❌ Protocol handler error:', error)
      
      // Show error dialog
      dialog.showErrorBox(
        'Protocol Error', 
        `Failed to handle URL: ${protocolUrl}\n\nError: ${error.message}`
      )
    }
  }

  /**
   * Get existing main window or create new one
   */
  private async getOrCreateMainWindow(): Promise<BrowserWindow> {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow
    }

    this.mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      icon: this.getAppIcon(),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        webSecurity: true,
        allowRunningInsecureContent: false
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false // Don't show until ready
    })

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null
    })

    return this.mainWindow
  }

  /**
   * Handle search action: grahmos://search?q=query
   */
  private async handleSearchAction(window: BrowserWindow, params: URLSearchParams): Promise<void> {
    const query = params.get('q') || ''
    const targetUrl = `${GRAHMOS_CONFIG.pwa.url}/search?q=${encodeURIComponent(query)}`
    
    console.log('🔍 Opening search:', query)
    await window.loadURL(targetUrl)
  }

  /**
   * Handle emergency action: grahmos://emergency?type=flood
   */
  private async handleEmergencyAction(window: BrowserWindow, params: URLSearchParams): Promise<void> {
    const emergencyType = params.get('type') || 'general'
    const location = params.get('location') || ''
    
    let targetUrl = `${GRAHMOS_CONFIG.pwa.url}/emergency`
    if (emergencyType !== 'general') {
      targetUrl += `?type=${encodeURIComponent(emergencyType)}`
    }
    if (location) {
      targetUrl += `${emergencyType !== 'general' ? '&' : '?'}location=${encodeURIComponent(location)}`
    }

    console.log('🚨 Opening emergency mode:', emergencyType)
    await window.loadURL(targetUrl)
  }

  /**
   * Handle mapping action: grahmos://mapping?lat=37.7749&lng=-122.4194
   */
  private async handleMappingAction(window: BrowserWindow, params: URLSearchParams): Promise<void> {
    const lat = params.get('lat')
    const lng = params.get('lng') 
    const zoom = params.get('zoom') || '12'
    
    let targetUrl = `${GRAHMOS_CONFIG.pwa.url}/mapping`
    if (lat && lng) {
      targetUrl += `?lat=${lat}&lng=${lng}&zoom=${zoom}`
    }

    console.log('🗺️ Opening mapping:', { lat, lng, zoom })
    await window.loadURL(targetUrl)
  }

  /**
   * Handle network action: grahmos://network?peer=id
   */
  private async handleNetworkAction(window: BrowserWindow, params: URLSearchParams): Promise<void> {
    const peerId = params.get('peer')
    const action = params.get('action') // connect, disconnect, info
    
    let targetUrl = `${GRAHMOS_CONFIG.pwa.url}/network`
    if (peerId) {
      targetUrl += `?peer=${encodeURIComponent(peerId)}`
      if (action) {
        targetUrl += `&action=${encodeURIComponent(action)}`
      }
    }

    console.log('🌐 Opening network:', { peerId, action })
    await window.loadURL(targetUrl)
  }

  /**
   * Handle settings action: grahmos://settings?tab=privacy
   */
  private async handleSettingsAction(window: BrowserWindow, params: URLSearchParams): Promise<void> {
    const tab = params.get('tab') || 'general'
    const targetUrl = `${GRAHMOS_CONFIG.pwa.url}/settings?tab=${encodeURIComponent(tab)}`

    console.log('⚙️ Opening settings:', tab)
    await window.loadURL(targetUrl)
  }

  /**
   * Handle launch action: grahmos://launch
   */
  private async handleLaunchAction(window: BrowserWindow, params: URLSearchParams): Promise<void> {
    const targetUrl = `${GRAHMOS_CONFIG.pwa.url}/launch`

    console.log('🚀 Opening launcher')
    await window.loadURL(targetUrl)
  }

  /**
   * Get platform-specific app icon
   */
  private getAppIcon(): string {
    const iconPath = path.join(__dirname, '../../assets/icons')
    
    switch (process.platform) {
      case 'win32':
        return path.join(iconPath, 'win/grahmos.ico')
      case 'darwin':
        return path.join(iconPath, 'mac/grahmos.icns')
      case 'linux':
      default:
        return path.join(iconPath, 'linux/grahmos.png')
    }
  }

  /**
   * Set main window reference (called from main process)
   */
  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.close()
    }
  }
}

// Export singleton instance
export const protocolHandler = new GrahmosProtocolHandler()

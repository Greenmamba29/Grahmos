const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const fs = require('fs').promises;
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const os = require('os');
const which = require('which');

// Configure logging
log.transports.file.level = 'info';
log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
autoUpdater.logger = log;

// Configure auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowDowngrade = false;

// Release channel configuration
const releaseChannel = process.env.GRAHMOS_RELEASE_CHANNEL || 'latest';
const updateServerUrl = process.env.GRAHMOS_UPDATE_URL || 'https://releases.grahmos.com';

if (app.isPackaged) {
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: `${updateServerUrl}/${releaseChannel}`,
    channel: releaseChannel
  });
}

log.info(`Auto-updater configured for channel: ${releaseChannel}`);
log.info(`Update server URL: ${updateServerUrl}`);
log.info(`App version: ${app.getVersion()}`);
log.info(`Platform: ${process.platform}-${process.arch}`);

class GrahmosInstaller {
  constructor() {
    this.mainWindow = null;
    this.installationPath = null;
    this.installationProgress = 0;
    this.platform = os.platform();
    this.arch = os.arch();
  }

  async createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      icon: this.getIcon(),
      titleBarStyle: 'default',
      show: false,
      autoHideMenuBar: true
    });

    // Load the installer UI
    await this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      
      // Check for updates
      if (!app.isPackaged) {
        log.info('Running in development mode, skipping auto-updater');
      } else {
        autoUpdater.checkForUpdatesAndNotify();
      }
    });

    this.setupIpcHandlers();
  }

  getIcon() {
    const iconPath = path.join(__dirname, '..', 'assets');
    switch (this.platform) {
      case 'win32':
        return path.join(iconPath, 'icon.ico');
      case 'darwin':
        return path.join(iconPath, 'icon.icns');
      default:
        return path.join(iconPath, 'icon.png');
    }
  }

  setupIpcHandlers() {
    // System requirements check
    ipcMain.handle('check-system-requirements', async () => {
      return await this.checkSystemRequirements();
    });

    // Docker installation
    ipcMain.handle('check-docker', async () => {
      return await this.checkDocker();
    });

    ipcMain.handle('install-docker', async () => {
      return await this.installDocker();
    });

    // Grahmos installation
    ipcMain.handle('choose-installation-path', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
        title: 'Choose Installation Directory',
        defaultPath: this.getDefaultInstallPath()
      });

      if (!result.canceled && result.filePaths.length > 0) {
        this.installationPath = result.filePaths[0];
        return this.installationPath;
      }
      return null;
    });

    ipcMain.handle('install-grahmos', async (event, options) => {
      return await this.installGrahmos(options);
    });

    ipcMain.handle('start-grahmos', async () => {
      return await this.startGrahmos();
    });

    ipcMain.handle('get-system-info', () => {
      return {
        platform: this.platform,
        arch: this.arch,
        version: os.release(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpus: os.cpus().length
      };
    });

    // Open external links
    ipcMain.handle('open-external', async (event, url) => {
      await shell.openExternal(url);
    });
    
    // Update management
    ipcMain.handle('check-for-updates', async () => {
      if (!app.isPackaged) {
        return { available: false, reason: 'Development mode' };
      }
      
      try {
        const updateCheckResult = await autoUpdater.checkForUpdates();
        return {
          available: !!updateCheckResult?.updateInfo,
          updateInfo: updateCheckResult?.updateInfo
        };
      } catch (error) {
        log.error('Update check failed:', error);
        return { available: false, error: error.message };
      }
    });
    
    ipcMain.handle('download-update', async () => {
      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (error) {
        log.error('Update download failed:', error);
        return { success: false, error: error.message };
      }
    });
    
    ipcMain.handle('install-update', async () => {
      autoUpdater.quitAndInstall(false, true);
    });
    
    ipcMain.handle('get-current-version', () => {
      return {
        version: app.getVersion(),
        channel: releaseChannel,
        platform: `${process.platform}-${process.arch}`
      };
    });
    
    ipcMain.handle('switch-release-channel', async (event, newChannel) => {
      // This would require a restart to take effect
      // Store the new channel preference
      const configPath = path.join(os.homedir(), '.grahmos', 'config.json');
      try {
        await fs.mkdir(path.dirname(configPath), { recursive: true });
        const config = { releaseChannel: newChannel };
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        
        return {
          success: true,
          message: 'Release channel will be updated on next restart',
          requiresRestart: true
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }

  async checkSystemRequirements() {
    const requirements = {
      memory: 8 * 1024 * 1024 * 1024, // 8GB
      diskSpace: 10 * 1024 * 1024 * 1024, // 10GB
      dockerRequired: true
    };

    const systemInfo = {
      memory: os.totalmem(),
      platform: this.platform,
      arch: this.arch,
      node: process.version
    };

    const checks = {
      memory: systemInfo.memory >= requirements.memory,
      diskSpace: true, // We'll check this when path is selected
      docker: await this.checkDocker(),
      platform: ['darwin', 'win32', 'linux'].includes(this.platform)
    };

    return {
      requirements,
      systemInfo,
      checks,
      passed: Object.values(checks).every(check => check === true)
    };
  }

  async checkDocker() {
    try {
      // Check if docker command exists
      await which('docker');
      
      // Check if docker is running
      const { stdout } = await execAsync('docker info');
      return {
        installed: true,
        running: true,
        version: await this.getDockerVersion()
      };
    } catch (error) {
      log.error('Docker check failed:', error);
      return {
        installed: false,
        running: false,
        version: null,
        error: error.message
      };
    }
  }

  async getDockerVersion() {
    try {
      const { stdout } = await execAsync('docker --version');
      return stdout.trim();
    } catch (error) {
      return null;
    }
  }

  async installDocker() {
    const installProgress = {
      step: 'downloading',
      progress: 0,
      message: 'Downloading Docker Desktop...'
    };

    this.mainWindow.webContents.send('docker-install-progress', installProgress);

    try {
      switch (this.platform) {
        case 'darwin':
          return await this.installDockerMacOS();
        case 'win32':
          return await this.installDockerWindows();
        case 'linux':
          return await this.installDockerLinux();
        default:
          throw new Error(`Unsupported platform: ${this.platform}`);
      }
    } catch (error) {
      log.error('Docker installation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async installDockerMacOS() {
    const downloadUrl = this.arch === 'arm64' 
      ? 'https://desktop.docker.com/mac/main/arm64/Docker.dmg'
      : 'https://desktop.docker.com/mac/main/amd64/Docker.dmg';
    
    // Open Docker Desktop download page
    await shell.openExternal('https://www.docker.com/products/docker-desktop/');
    
    return {
      success: true,
      message: 'Please download and install Docker Desktop from the opened webpage, then restart this installer.',
      requiresManualAction: true
    };
  }

  async installDockerWindows() {
    // Open Docker Desktop download page
    await shell.openExternal('https://www.docker.com/products/docker-desktop/');
    
    return {
      success: true,
      message: 'Please download and install Docker Desktop from the opened webpage, then restart this installer.',
      requiresManualAction: true
    };
  }

  async installDockerLinux() {
    // For Linux, we can provide instructions or automated installation
    const installScript = `
      # Update package index
      sudo apt-get update
      
      # Install prerequisites
      sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
      
      # Add Docker GPG key
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
      
      # Add Docker repository
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
      
      # Install Docker
      sudo apt-get update
      sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
      
      # Add user to docker group
      sudo usermod -aG docker $USER
      
      # Start Docker service
      sudo systemctl enable docker
      sudo systemctl start docker
    `;

    return {
      success: true,
      message: 'Docker installation script prepared. Please run the provided commands in your terminal.',
      script: installScript,
      requiresManualAction: true
    };
  }

  getDefaultInstallPath() {
    switch (this.platform) {
      case 'darwin':
        return path.join(os.homedir(), 'Applications', 'Grahmos');
      case 'win32':
        return path.join(os.homedir(), 'AppData', 'Local', 'Grahmos');
      default:
        return path.join(os.homedir(), '.grahmos');
    }
  }

  async installGrahmos(options = {}) {
    if (!this.installationPath) {
      this.installationPath = this.getDefaultInstallPath();
    }

    const installSteps = [
      'Creating installation directory',
      'Copying application files',
      'Setting up configuration',
      'Creating shortcuts',
      'Final setup'
    ];

    try {
      // Create installation directory
      await fs.mkdir(this.installationPath, { recursive: true });
      this.updateInstallProgress(0, installSteps[0]);

      // Copy application files
      const resourcesPath = app.isPackaged 
        ? path.join(process.resourcesPath)
        : path.join(__dirname, '..');

      await this.copyFiles(resourcesPath, this.installationPath);
      this.updateInstallProgress(20, installSteps[1]);

      // Set up configuration
      await this.setupConfiguration();
      this.updateInstallProgress(50, installSteps[2]);

      // Create shortcuts
      await this.createShortcuts();
      this.updateInstallProgress(80, installSteps[3]);

      // Final setup
      await this.finalSetup();
      this.updateInstallProgress(100, installSteps[4]);

      return {
        success: true,
        installationPath: this.installationPath,
        message: 'Grahmos has been successfully installed!'
      };

    } catch (error) {
      log.error('Grahmos installation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async copyFiles(source, destination) {
    // Copy Docker Compose files
    const dockerComposeSource = path.join(source, 'docker-compose.yml');
    const dockerComposeDest = path.join(destination, 'docker-compose.yml');
    
    try {
      await fs.copyFile(dockerComposeSource, dockerComposeDest);
    } catch (error) {
      log.warn('Could not copy docker-compose.yml:', error);
    }

    // Copy scripts
    const scriptsSource = path.join(source, 'scripts');
    const scriptsDest = path.join(destination, 'scripts');
    
    try {
      await fs.mkdir(scriptsDest, { recursive: true });
      const files = await fs.readdir(scriptsSource);
      
      for (const file of files) {
        if (file.endsWith('.sh')) {
          await fs.copyFile(
            path.join(scriptsSource, file),
            path.join(scriptsDest, file)
          );
          // Make scripts executable on Unix systems
          if (this.platform !== 'win32') {
            await execAsync(`chmod +x "${path.join(scriptsDest, file)}"`);
          }
        }
      }
    } catch (error) {
      log.warn('Could not copy scripts:', error);
    }

    // Copy startup script
    const startupScriptSource = path.join(source, 'start-grahmos.sh');
    const startupScriptDest = path.join(destination, 'start-grahmos.sh');
    
    try {
      await fs.copyFile(startupScriptSource, startupScriptDest);
      if (this.platform !== 'win32') {
        await execAsync(`chmod +x "${startupScriptDest}"`);
      }
    } catch (error) {
      log.warn('Could not copy startup script:', error);
    }
  }

  async setupConfiguration() {
    const envTemplatePath = path.join(this.installationPath, '.env.template');
    const envPath = path.join(this.installationPath, '.env');
    
    try {
      // Copy environment template to .env if it doesn't exist
      const envExists = await fs.access(envPath).then(() => true).catch(() => false);
      if (!envExists) {
        const templateExists = await fs.access(envTemplatePath).then(() => true).catch(() => false);
        if (templateExists) {
          await fs.copyFile(envTemplatePath, envPath);
        }
      }
    } catch (error) {
      log.warn('Could not setup configuration:', error);
    }
  }

  async createShortcuts() {
    // Create desktop shortcut
    if (this.platform === 'win32') {
      await this.createWindowsShortcut();
    } else if (this.platform === 'darwin') {
      await this.createMacOSShortcut();
    } else {
      await this.createLinuxShortcut();
    }
  }

  async createWindowsShortcut() {
    // Windows shortcut creation would use a PowerShell script or Windows API
    const shortcutScript = `
      $WshShell = New-Object -comObject WScript.Shell
      $Shortcut = $WshShell.CreateShortcut("$Home\\Desktop\\Grahmos.lnk")
      $Shortcut.TargetPath = "${path.join(this.installationPath, 'start-grahmos.bat')}"
      $Shortcut.WorkingDirectory = "${this.installationPath}"
      $Shortcut.Description = "Grahmos Enterprise Knowledge Search"
      $Shortcut.Save()
    `;
    
    // Also create a batch file to start Grahmos
    const batchScript = `@echo off
cd /d "${this.installationPath}"
powershell -ExecutionPolicy Bypass -File start-grahmos.ps1
pause`;
    
    await fs.writeFile(path.join(this.installationPath, 'start-grahmos.bat'), batchScript);
  }

  async createMacOSShortcut() {
    // macOS: Create an application bundle or alias
    const shortcutScript = `#!/bin/bash
cd "${this.installationPath}"
./start-grahmos.sh
`;
    
    const shortcutPath = path.join(os.homedir(), 'Desktop', 'Grahmos.command');
    await fs.writeFile(shortcutPath, shortcutScript);
    await execAsync(`chmod +x "${shortcutPath}"`);
  }

  async createLinuxShortcut() {
    // Linux: Create a .desktop file
    const desktopEntry = `[Desktop Entry]
Version=1.0
Type=Application
Name=Grahmos Desktop
Comment=Enterprise Knowledge Search & AI Assistant
Exec=${path.join(this.installationPath, 'start-grahmos.sh')}
Icon=${path.join(this.installationPath, 'assets', 'icon.png')}
Terminal=false
StartupNotify=true
Categories=Office;Education;
`;

    const desktopPath = path.join(os.homedir(), 'Desktop', 'Grahmos.desktop');
    await fs.writeFile(desktopPath, desktopEntry);
    await execAsync(`chmod +x "${desktopPath}"`);
  }

  async finalSetup() {
    // Create uninstaller
    await this.createUninstaller();
    
    // Register with system (add to installed programs list)
    if (this.platform === 'win32') {
      await this.registerWindowsProgram();
    }
  }

  async createUninstaller() {
    let uninstallScript;
    
    switch (this.platform) {
      case 'win32':
        uninstallScript = `@echo off
echo Uninstalling Grahmos...
cd /d "${this.installationPath}"
docker-compose down
rmdir /s /q "${this.installationPath}"
echo Grahmos has been uninstalled.
pause`;
        await fs.writeFile(path.join(this.installationPath, 'uninstall.bat'), uninstallScript);
        break;
        
      case 'darwin':
      case 'linux':
        uninstallScript = `#!/bin/bash
echo "Uninstalling Grahmos..."
cd "${this.installationPath}"
./start-grahmos.sh stop 2>/dev/null || true
rm -rf "${this.installationPath}"
rm -f "$HOME/Desktop/Grahmos.command" 2>/dev/null || true
rm -f "$HOME/Desktop/Grahmos.desktop" 2>/dev/null || true
echo "Grahmos has been uninstalled."`;
        await fs.writeFile(path.join(this.installationPath, 'uninstall.sh'), uninstallScript);
        await execAsync(`chmod +x "${path.join(this.installationPath, 'uninstall.sh')}"`);
        break;
    }
  }

  async registerWindowsProgram() {
    // This would typically require elevated privileges
    // For now, we'll skip the registry modification
    log.info('Windows program registration skipped (requires elevation)');
  }

  updateInstallProgress(progress, message) {
    this.installationProgress = progress;
    this.mainWindow.webContents.send('install-progress', {
      progress,
      message
    });
  }

  async startGrahmos() {
    if (!this.installationPath) {
      return { success: false, error: 'Grahmos is not installed' };
    }

    try {
      const scriptPath = path.join(this.installationPath, 'start-grahmos.sh');
      const scriptExists = await fs.access(scriptPath).then(() => true).catch(() => false);
      
      if (!scriptExists) {
        return { success: false, error: 'Startup script not found' };
      }

      // Start Grahmos in background
      const child = spawn('bash', [scriptPath], {
        cwd: this.installationPath,
        detached: true,
        stdio: 'ignore'
      });

      child.unref();

      // Give it a moment to start
      setTimeout(() => {
        shell.openExternal('http://localhost:8080');
      }, 10000);

      return {
        success: true,
        message: 'Grahmos is starting... The web interface will open automatically.',
        pid: child.pid
      };

    } catch (error) {
      log.error('Failed to start Grahmos:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Initialize the installer
const installer = new GrahmosInstaller();

app.whenReady().then(async () => {
  await installer.createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await installer.createMainWindow();
  }
});

// Auto updater events with enhanced user communication
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
  if (installer.mainWindow) {
    installer.mainWindow.webContents.send('update-checking');
  }
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info.version);
  if (installer.mainWindow) {
    installer.mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate,
      size: info.files ? info.files[0]?.size : null
    });
  }
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available.');
  if (installer.mainWindow) {
    installer.mainWindow.webContents.send('update-not-available');
  }
});

autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater:', err);
  if (installer.mainWindow) {
    installer.mainWindow.webContents.send('update-error', {
      message: err.message,
      stack: err.stack
    });
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
  log.info(logMessage);
  
  if (installer.mainWindow) {
    installer.mainWindow.webContents.send('update-download-progress', {
      percent: Math.round(progressObj.percent),
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded, ready to install');
  if (installer.mainWindow) {
    installer.mainWindow.webContents.send('update-downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes
    });
  }
  
  // Show user prompt instead of auto-installing
  const response = dialog.showMessageBoxSync(installer.mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: `Grahmos ${info.version} has been downloaded and is ready to install.`,
    detail: 'The application will restart to apply the update.',
    buttons: ['Install Now', 'Install Later'],
    defaultId: 0,
    cancelId: 1
  });
  
  if (response === 0) {
    autoUpdater.quitAndInstall(false, true);
  }
});

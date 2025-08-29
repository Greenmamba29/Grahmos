# Grahmos Auto-Update System Documentation

## Overview

The Grahmos Desktop application includes a comprehensive auto-update system built on top of `electron-updater`. This system provides seamless, secure updates across Windows, macOS, and Linux platforms with support for multiple release channels.

## Architecture

### Components

1. **electron-updater** - Core update mechanism
2. **GitHub Releases** - Release distribution platform
3. **Update Manifests** - Platform-specific metadata files
4. **CI/CD Pipeline** - Automated build and release system
5. **Code Signing** - Security validation for releases

### Release Channels

- **latest** - Stable production releases
- **beta** - Pre-release builds for testing

## How It Works

### 1. Update Detection

The application periodically checks for updates by fetching platform-specific manifest files:

- **Windows**: `latest.yml` 
- **macOS**: `latest-mac.yml`
- **Linux**: `latest-linux.yml`

These manifests contain version information, download URLs, and cryptographic hashes.

### 2. Version Comparison

The system compares the current application version with the available version using semantic versioning rules:

- `2.0.1` > `2.0.0` (patch update)
- `2.1.0` > `2.0.9` (minor update) 
- `3.0.0` > `2.9.9` (major update)
- `2.0.0` > `2.0.0-beta.1` (stable > prerelease)

### 3. Download & Verification

When an update is available:
1. Downloads the installer/update package
2. Verifies the SHA512 hash against the manifest
3. Validates code signature (if available)
4. Prompts user for installation

### 4. Installation

Updates are installed using platform-specific methods:
- **Windows**: NSIS installer or MSI package
- **macOS**: DMG mounting and app replacement
- **Linux**: AppImage replacement or package manager

## Configuration

### Electron Main Process (`installer/src/main.js`)

```javascript
import { autoUpdater } from 'electron-updater';

// Configure update server and channels
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'grahmos',
  repo: 'desktop',
  channel: process.env.GRAHMOS_RELEASE_CHANNEL || 'latest'
});

// Enable logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Auto-download updates (configurable)
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
```

### Package Configuration (`installer/package.json`)

```json
{
  "build": {
    "publish": [
      {
        "provider": "github",
        "owner": "grahmos",
        "repo": "desktop",
        "channel": "latest"
      },
      {
        "provider": "generic",
        "url": "https://releases.grahmos.dev",
        "channel": "latest"
      }
    ]
  }
}
```

## Update Manifest Format

### Windows (`latest.yml`)

```yaml
version: 2.0.0
releaseDate: '2024-01-15T10:30:00.000Z'
files:
  - url: Grahmos-Setup-2.0.0.exe
    sha512: base64-encoded-hash
    size: 123456789
    blockMapSize: 98765
```

### macOS (`latest-mac.yml`)

```yaml
version: 2.0.0
releaseDate: '2024-01-15T10:30:00.000Z'
files:
  - url: Grahmos-2.0.0.dmg
    sha512: base64-encoded-hash
    size: 123456789
  - url: Grahmos-2.0.0-mac.zip
    sha512: base64-encoded-hash
    size: 98765432
```

### Linux (`latest-linux.yml`)

```yaml
version: 2.0.0
releaseDate: '2024-01-15T10:30:00.000Z'
files:
  - url: Grahmos-2.0.0.AppImage
    sha512: base64-encoded-hash
    size: 123456789
```

## CI/CD Integration

### GitHub Actions Workflow

The auto-update system integrates with the CI/CD pipeline in `.github/workflows/desktop-release.yml`:

1. **Build Phase**: Creates platform-specific installers
2. **Manifest Generation**: Generates update manifest files
3. **Release Creation**: Publishes to GitHub Releases
4. **Asset Upload**: Includes manifests and installers

### Scripts

#### Version Management (`scripts/version-bump.js`)
- Automatically increments version numbers
- Updates all package.json files
- Generates changelog entries
- Creates Git tags

#### Manifest Generation (`scripts/generate-update-manifest.js`)
- Scans release assets
- Calculates SHA512 hashes
- Generates platform-specific YAML manifests
- Validates manifest structure

## Security

### Code Signing

All releases are code signed for security:

- **Windows**: Authenticode signing with certificates
- **macOS**: Apple Developer ID signing and notarization
- **Linux**: GPG signing (optional)

### Hash Verification

Every update file includes SHA512 hash verification:
- Prevents corrupted downloads
- Ensures file integrity
- Detects tampering attempts

### HTTPS Transport

All update communications use HTTPS:
- Encrypted manifest downloads
- Secure installer downloads
- Protected against man-in-the-middle attacks

## Testing

### Automated Testing (`scripts/test-auto-update.js`)

Run comprehensive auto-update tests:

```bash
node scripts/test-auto-update.js
```

Tests include:
- Manifest file validation
- Release asset verification
- electron-updater compatibility
- Version comparison logic
- Hash calculation accuracy

### Manual Testing

1. **Update Detection**:
   ```javascript
   // In renderer process
   ipcRenderer.invoke('check-for-updates');
   ```

2. **Force Update Check**:
   ```bash
   # Set environment variable
   export GRAHMOS_UPDATE_CHECK=force
   
   # Launch application
   npm start
   ```

3. **Channel Switching**:
   ```javascript
   // Switch to beta channel
   ipcRenderer.invoke('set-release-channel', 'beta');
   ```

## User Experience

### Update Notifications

The application provides user-friendly update notifications:

- **Available**: "Update available - Version X.X.X"
- **Downloading**: Progress bar with download percentage
- **Ready**: "Update downloaded - Restart to install"
- **Error**: Clear error messages with retry options

### Settings Integration

Users can configure update behavior:

- **Automatic Updates**: Enable/disable auto-downloading
- **Update Channel**: Switch between latest/beta
- **Check Frequency**: Custom update check intervals
- **Notifications**: Control update notification visibility

## Troubleshooting

### Common Issues

#### 1. Update Check Fails
```
Error: net::ERR_NETWORK_ERROR
```
**Solution**: Check network connectivity and GitHub accessibility

#### 2. Invalid Signature
```
Error: Code signing validation failed
```
**Solution**: Re-download the application from official sources

#### 3. Manifest Parse Error
```
Error: Invalid YAML format in manifest
```
**Solution**: Wait for corrected release or report issue

#### 4. Hash Verification Fails
```
Error: SHA512 mismatch
```
**Solution**: Re-download update or check network integrity

### Debug Mode

Enable debug logging:

```bash
# Set environment variables
export DEBUG=electron-updater
export ELECTRON_LOG_LEVEL=debug

# Launch application
npm start
```

### Log Files

Update logs are stored in:
- **Windows**: `%APPDATA%/Grahmos/logs/main.log`
- **macOS**: `~/Library/Logs/Grahmos/main.log`
- **Linux**: `~/.config/Grahmos/logs/main.log`

## API Reference

### Main Process

#### Check for Updates
```javascript
autoUpdater.checkForUpdates()
  .then(result => {
    console.log('Update check result:', result);
  })
  .catch(error => {
    console.error('Update check failed:', error);
  });
```

#### Download Update
```javascript
autoUpdater.downloadUpdate()
  .then(() => {
    console.log('Update downloaded successfully');
  })
  .catch(error => {
    console.error('Download failed:', error);
  });
```

#### Install and Restart
```javascript
autoUpdater.quitAndInstall();
```

### IPC Handlers

#### Check for Updates
```javascript
// Main process
ipcMain.handle('check-for-updates', async () => {
  return await autoUpdater.checkForUpdates();
});

// Renderer process
const result = await ipcRenderer.invoke('check-for-updates');
```

#### Set Release Channel
```javascript
// Main process
ipcMain.handle('set-release-channel', async (event, channel) => {
  autoUpdater.channel = channel;
  return channel;
});

// Renderer process
await ipcRenderer.invoke('set-release-channel', 'beta');
```

### Events

#### Update Available
```javascript
autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version);
  // Notify user
});
```

#### Update Downloaded
```javascript
autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info.version);
  // Show restart prompt
});
```

#### Download Progress
```javascript
autoUpdater.on('download-progress', (progress) => {
  console.log(`Download progress: ${progress.percent}%`);
  // Update progress bar
});
```

## Best Practices

### Development

1. **Test Updates Locally**: Use local update server for testing
2. **Validate Manifests**: Always verify manifest structure before release
3. **Incremental Releases**: Use patch versions for small updates
4. **Rollback Strategy**: Maintain ability to rollback problematic updates

### Deployment

1. **Staged Rollouts**: Release to beta channel first
2. **Monitor Metrics**: Track update success rates
3. **Quick Hotfixes**: Maintain fast release pipeline for critical issues
4. **Communication**: Notify users of important updates

### Security

1. **Certificate Management**: Keep signing certificates secure and up-to-date
2. **Hash Validation**: Always verify file integrity
3. **HTTPS Only**: Never use insecure transport protocols
4. **Access Control**: Limit who can create releases

## Metrics and Monitoring

### Update Statistics

Track key metrics:
- Update check frequency
- Download success rates
- Installation completion rates
- Error rates by platform/version
- User opt-out rates

### Error Reporting

Implement error tracking:
```javascript
autoUpdater.on('error', (error) => {
  // Report to monitoring service
  analytics.track('update_error', {
    error: error.message,
    version: app.getVersion(),
    platform: process.platform
  });
});
```

## Migration Guide

### From Manual Updates

1. **Remove Manual Check**: Remove manual update UI components
2. **Add Notifications**: Implement auto-update notifications
3. **User Education**: Inform users about automatic updates
4. **Fallback Options**: Provide manual download links as backup

### Version Compatibility

Ensure compatibility across versions:
- Database schema migrations
- Configuration file updates
- User data preservation
- Plugin compatibility

---

## Support

For issues with the auto-update system:

1. **Check Logs**: Review application logs for error details
2. **Test Network**: Verify GitHub/update server connectivity
3. **Manual Download**: Use manual installer as fallback
4. **Report Issues**: Submit bug reports with log files

For more information, see:
- [Electron Updater Documentation](https://www.electron.build/auto-update)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
- [Code Signing Guide](docs/CODE_SIGNING.md)

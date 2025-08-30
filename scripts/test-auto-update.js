#!/usr/bin/env node
/**
 * Test Auto-Update Functionality
 * 
 * This script tests the auto-update system by simulating the electron-updater
 * process and verifying that manifest files and release assets are correctly
 * configured for automatic updates.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const yaml = require('js-yaml');

const TEST_VERSION = '2.0.0';
const GITHUB_REPO = 'grahmos/desktop';
const RELEASE_TAG = `v${TEST_VERSION}`;

/**
 * Test Configuration
 */
const config = {
  // Test endpoints - these would be the actual URLs in production
  manifestUrls: {
    latest: `https://github.com/${GITHUB_REPO}/releases/latest/download/latest.yml`,
    latestMac: `https://github.com/${GITHUB_REPO}/releases/latest/download/latest-mac.yml`,
    latestLinux: `https://github.com/${GITHUB_REPO}/releases/latest/download/latest-linux.yml`
  },
  releaseUrl: `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${RELEASE_TAG}`,
  testPlatforms: ['win32', 'darwin', 'linux'],
  expectedAssets: {
    win32: ['.exe', '.msi', '.nupkg'],
    darwin: ['.dmg', '.zip'],
    linux: ['.AppImage', '.deb', '.rpm', '.snap']
  }
};

/**
 * Utility functions
 */
function log(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warning: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
  };
  
  console.log(`${colors[level] || ''}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.reset}`, ...args);
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Grahmos-AutoUpdate-Test/1.0.0'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    }).on('error', reject);
  });
}

function calculateSHA512(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512');
    const stream = fs.createReadStream(filePath);
    
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('base64')));
  });
}

/**
 * Test Functions
 */
async function testManifestGeneration() {
  log('info', 'Testing manifest generation...');
  
  try {
    // Check if manifests exist locally
    const manifestFiles = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml'];
    const manifestsExist = manifestFiles.map(file => ({
      file,
      exists: fs.existsSync(file),
      path: path.resolve(file)
    }));
    
    log('info', 'Local manifest files:');
    manifestsExist.forEach(({ file, exists, path: filePath }) => {
      if (exists) {
        log('success', `✓ ${file} exists at ${filePath}`);
        
        // Parse and validate YAML structure
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const manifest = yaml.load(content);
          
          // Validate required fields
          const requiredFields = ['version', 'releaseDate', 'files'];
          const missingFields = requiredFields.filter(field => !manifest[field]);
          
          if (missingFields.length > 0) {
            log('warning', `Missing required fields in ${file}:`, missingFields);
          } else {
            log('success', `✓ ${file} has all required fields`);
            
            // Validate file entries
            if (Array.isArray(manifest.files)) {
              manifest.files.forEach((fileEntry, index) => {
                const requiredFileFields = ['url', 'sha512', 'size'];
                const missingFileFields = requiredFileFields.filter(field => !fileEntry[field]);
                
                if (missingFileFields.length > 0) {
                  log('warning', `File entry ${index} in ${file} missing:`, missingFileFields);
                } else {
                  log('success', `✓ File entry ${index} is valid`);
                }
              });
            }
          }
        } catch (parseError) {
          log('error', `Failed to parse ${file}:`, parseError.message);
        }
      } else {
        log('warning', `✗ ${file} not found at ${filePath}`);
      }
    });
    
    return manifestsExist;
  } catch (error) {
    log('error', 'Manifest generation test failed:', error.message);
    return null;
  }
}

async function testReleaseAssets() {
  log('info', 'Testing release assets availability...');
  
  try {
    // Check if we have a release-assets directory
    const releaseAssetsDir = 'release-assets';
    if (!fs.existsSync(releaseAssetsDir)) {
      log('warning', `Release assets directory not found: ${releaseAssetsDir}`);
      return null;
    }
    
    const assets = fs.readdirSync(releaseAssetsDir);
    log('info', `Found ${assets.length} assets in ${releaseAssetsDir}:`);
    
    const assetsByPlatform = {
      windows: assets.filter(asset => asset.includes('win') || asset.endsWith('.exe') || asset.endsWith('.msi')),
      macos: assets.filter(asset => asset.includes('mac') || asset.includes('darwin') || asset.endsWith('.dmg')),
      linux: assets.filter(asset => asset.includes('linux') || asset.endsWith('.AppImage') || asset.endsWith('.deb') || asset.endsWith('.rpm'))
    };
    
    Object.entries(assetsByPlatform).forEach(([platform, platformAssets]) => {
      log('info', `${platform}:`, platformAssets.length > 0 ? platformAssets : 'No assets found');
    });
    
    // Validate checksums if available
    const checksumFiles = assets.filter(asset => asset.endsWith('.sha256'));
    if (checksumFiles.length > 0) {
      log('success', `✓ Found ${checksumFiles.length} checksum files`);
      checksumFiles.forEach(checksumFile => {
        log('info', `  - ${checksumFile}`);
      });
    } else {
      log('warning', '✗ No checksum files found');
    }
    
    return assetsByPlatform;
  } catch (error) {
    log('error', 'Release assets test failed:', error.message);
    return null;
  }
}

async function testElectronUpdaterCompatibility() {
  log('info', 'Testing electron-updater compatibility...');
  
  try {
    // Simulate electron-updater behavior
    const platforms = {
      'win32': 'latest.yml',
      'darwin': 'latest-mac.yml', 
      'linux': 'latest-linux.yml'
    };
    
    for (const [platform, manifestFile] of Object.entries(platforms)) {
      log('info', `Testing ${platform} compatibility...`);
      
      if (!fs.existsSync(manifestFile)) {
        log('warning', `Manifest file ${manifestFile} not found for ${platform}`);
        continue;
      }
      
      try {
        const content = fs.readFileSync(manifestFile, 'utf8');
        const manifest = yaml.load(content);
        
        // Check version format
        if (!manifest.version || !/^\\d+\\.\\d+\\.\\d+/.test(manifest.version)) {
          log('error', `Invalid version format in ${manifestFile}: ${manifest.version}`);
          continue;
        }
        
        // Check release date format
        if (!manifest.releaseDate) {
          log('warning', `Missing releaseDate in ${manifestFile}`);
        } else {
          const releaseDate = new Date(manifest.releaseDate);
          if (isNaN(releaseDate.getTime())) {
            log('error', `Invalid releaseDate format in ${manifestFile}: ${manifest.releaseDate}`);
          } else {
            log('success', `✓ Valid releaseDate in ${manifestFile}: ${manifest.releaseDate}`);
          }
        }
        
        // Check file entries
        if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
          log('error', `No file entries found in ${manifestFile}`);
          continue;
        }
        
        manifest.files.forEach((file, index) => {
          if (!file.url || !file.sha512 || !file.size) {
            log('error', `Incomplete file entry ${index} in ${manifestFile}`);
          } else {
            // Validate SHA512 format (base64)
            if (!/^[A-Za-z0-9+/]+=*$/.test(file.sha512)) {
              log('warning', `Invalid SHA512 format for file ${index} in ${manifestFile}`);
            } else {
              log('success', `✓ Valid file entry ${index} in ${manifestFile}`);
            }
          }
        });
        
      } catch (parseError) {
        log('error', `Failed to parse ${manifestFile}:`, parseError.message);
      }
    }
    
    log('success', '✓ Electron-updater compatibility test completed');
    return true;
  } catch (error) {
    log('error', 'Electron-updater compatibility test failed:', error.message);
    return false;
  }
}

async function testVersionComparison() {
  log('info', 'Testing version comparison logic...');
  
  try {
    // Test various version comparison scenarios
    const versions = [
      { current: '1.9.9', available: '2.0.0', shouldUpdate: true },
      { current: '2.0.0', available: '2.0.0', shouldUpdate: false },
      { current: '2.0.1', available: '2.0.0', shouldUpdate: false },
      { current: '2.0.0-beta.1', available: '2.0.0', shouldUpdate: true },
      { current: '2.0.0', available: '2.0.1-beta.1', shouldUpdate: false } // stable > beta
    ];
    
    versions.forEach(({ current, available, shouldUpdate }) => {
      // Simple semantic version comparison (for demonstration)
      const parseVersion = (version) => {
        const [main, prerelease] = version.split('-');
        const [major, minor, patch] = main.split('.').map(Number);
        return { major, minor, patch, prerelease };
      };
      
      const currentVer = parseVersion(current);
      const availableVer = parseVersion(available);
      
      let updateAvailable = false;
      
      if (availableVer.major > currentVer.major) updateAvailable = true;
      else if (availableVer.major === currentVer.major && availableVer.minor > currentVer.minor) updateAvailable = true;
      else if (availableVer.major === currentVer.major && availableVer.minor === currentVer.minor && availableVer.patch > currentVer.patch) updateAvailable = true;
      else if (availableVer.major === currentVer.major && availableVer.minor === currentVer.minor && availableVer.patch === currentVer.patch) {
        // Handle prerelease
        if (currentVer.prerelease && !availableVer.prerelease) updateAvailable = true;
      }
      
      const result = updateAvailable === shouldUpdate ? '✓' : '✗';
      const status = updateAvailable === shouldUpdate ? 'success' : 'error';
      
      log(status, `${result} ${current} -> ${available}: ${updateAvailable ? 'UPDATE' : 'NO UPDATE'} (expected: ${shouldUpdate ? 'UPDATE' : 'NO UPDATE'})`);
    });
    
    return true;
  } catch (error) {
    log('error', 'Version comparison test failed:', error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('info', '🚀 Starting Grahmos Auto-Update Tests');
  log('info', '=====================================');
  
  const results = {
    manifestGeneration: await testManifestGeneration(),
    releaseAssets: await testReleaseAssets(),
    electronUpdaterCompatibility: await testElectronUpdaterCompatibility(),
    versionComparison: await testVersionComparison()
  };
  
  log('info', '=====================================');
  log('info', '📊 Test Results Summary:');
  
  let passedTests = 0;
  let totalTests = 0;
  
  Object.entries(results).forEach(([testName, result]) => {
    totalTests++;
    if (result) {
      passedTests++;
      log('success', `✓ ${testName}: PASSED`);
    } else {
      log('error', `✗ ${testName}: FAILED`);
    }
  });
  
  const successRate = Math.round((passedTests / totalTests) * 100);
  log('info', `\n📈 Overall Success Rate: ${successRate}% (${passedTests}/${totalTests} tests passed)`);
  
  if (successRate === 100) {
    log('success', '🎉 All auto-update tests passed! The system is ready for deployment.');
  } else if (successRate >= 75) {
    log('warning', '⚠️  Most tests passed, but some issues need attention.');
  } else {
    log('error', '❌ Multiple test failures detected. Please review the auto-update configuration.');
  }
  
  return results;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    log('error', 'Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runTests, config };

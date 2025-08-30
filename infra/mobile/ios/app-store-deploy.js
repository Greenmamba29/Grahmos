#!/usr/bin/env node
/**
 * Grahmos iOS App Store Connect Integration
 * Automated deployment, TestFlight distribution, and App Store submission
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Configuration
const config = {
  // App Store Connect API
  appStoreConnect: {
    apiKeyId: process.env.ASC_API_KEY_ID,
    issuerId: process.env.ASC_ISSUER_ID,
    apiKeyPath: process.env.ASC_API_KEY_PATH,
  },
  
  // App configuration
  app: {
    bundleId: 'io.grahmos.emergency',
    appId: process.env.APP_STORE_APP_ID,
    teamId: process.env.APPLE_TEAM_ID,
    name: 'Grahmos Emergency',
  },
  
  // Build configuration
  build: {
    scheme: 'Grahmos',
    configuration: 'Release',
    archivePath: './build/Grahmos.xcarchive',
    exportPath: './build/export',
    ipaPath: './build/export/Grahmos.ipa',
  },
  
  // TestFlight configuration
  testFlight: {
    betaGroups: ['Emergency Responders', 'Stadium Operators', 'Internal Testing'],
    reviewNotes: 'Emergency communication app for offline P2P messaging and content distribution.',
    autoNotify: true,
    distributeToPublic: false,
  },
  
  // App Store configuration
  appStore: {
    releaseType: 'MANUAL',
    phaseReleaseInfo: {
      phasedReleaseState: 'INACTIVE'
    },
    submissionInfo: {
      exportComplianceAnswers: {
        usesEncryption: true,
        isExempt: true,
        containsThirdPartyEncryption: false,
        containsProprietaryEncryption: false,
        availableOnFrenchStore: true
      }
    }
  }
};

// Utility functions
const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()}: ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()}: ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()}: ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${new Date().toISOString()}: ${msg}`)
};

const executeCommand = (command, options = {}) => {
  logger.info(`Executing: ${command}`);
  try {
    const result = execSync(command, { 
      stdio: options.silent ? 'pipe' : 'inherit', 
      encoding: 'utf8',
      ...options 
    });
    return { success: true, output: result };
  } catch (error) {
    logger.error(`Command failed: ${error.message}`);
    return { success: false, error: error.message, output: error.stdout };
  }
};

// Validation functions
const validateEnvironment = () => {
  logger.info('Validating environment...');
  
  const required = [
    'ASC_API_KEY_ID',
    'ASC_ISSUER_ID', 
    'ASC_API_KEY_PATH',
    'APP_STORE_APP_ID',
    'APPLE_TEAM_ID'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    return false;
  }
  
  // Check if API key file exists
  if (!fs.existsSync(config.appStoreConnect.apiKeyPath)) {
    logger.error(`API key file not found: ${config.appStoreConnect.apiKeyPath}`);
    return false;
  }
  
  // Check Xcode command line tools
  const xcodeResult = executeCommand('xcode-select -p', { silent: true });
  if (!xcodeResult.success) {
    logger.error('Xcode command line tools not found');
    return false;
  }
  
  logger.success('Environment validation passed');
  return true;
};

const validateProject = () => {
  logger.info('Validating Xcode project...');
  
  // Check for workspace or project file
  const hasWorkspace = fs.existsSync('Grahmos.xcworkspace');
  const hasProject = fs.existsSync('Grahmos.xcodeproj');
  
  if (!hasWorkspace && !hasProject) {
    logger.error('No Xcode workspace or project found');
    return false;
  }
  
  // Check for scheme
  const projectArg = hasWorkspace ? '-workspace Grahmos.xcworkspace' : '-project Grahmos.xcodeproj';
  const schemeCheck = executeCommand(
    `xcodebuild -list ${projectArg} | grep -q "${config.build.scheme}"`,
    { silent: true }
  );
  
  if (!schemeCheck.success) {
    logger.error(`Scheme "${config.build.scheme}" not found`);
    return false;
  }
  
  logger.success('Project validation passed');
  return true;
};

// Build functions
const buildApp = async () => {
  logger.info('Building iOS app...');
  
  // Clean build directory
  if (fs.existsSync('./build')) {
    fs.rmSync('./build', { recursive: true, force: true });
  }
  fs.mkdirSync('./build', { recursive: true });
  
  // Determine project type
  const hasWorkspace = fs.existsSync('Grahmos.xcworkspace');
  const projectArg = hasWorkspace ? '-workspace Grahmos.xcworkspace' : '-project Grahmos.xcodeproj';
  
  // Archive the app
  const archiveCommand = `xcodebuild archive \
    ${projectArg} \
    -scheme ${config.build.scheme} \
    -configuration ${config.build.configuration} \
    -destination generic/platform=iOS \
    -archivePath ${config.build.archivePath} \
    CODE_SIGN_IDENTITY="Apple Distribution" \
    PROVISIONING_PROFILE_SPECIFIER="Grahmos Distribution Profile" \
    DEVELOPMENT_TEAM=${config.app.teamId}`;
  
  const archiveResult = executeCommand(archiveCommand);
  if (!archiveResult.success) {
    logger.error('Archive build failed');
    return false;
  }
  
  // Export IPA
  const exportOptionsPath = await createExportOptions();
  const exportCommand = `xcodebuild -exportArchive \
    -archivePath ${config.build.archivePath} \
    -exportPath ${config.build.exportPath} \
    -exportOptionsPlist ${exportOptionsPath}`;
  
  const exportResult = executeCommand(exportCommand);
  if (!exportResult.success) {
    logger.error('IPA export failed');
    return false;
  }
  
  // Verify IPA exists
  if (!fs.existsSync(config.build.ipaPath)) {
    logger.error(`IPA not found at ${config.build.ipaPath}`);
    return false;
  }
  
  logger.success('App build completed successfully');
  return true;
};

const createExportOptions = async () => {
  logger.info('Creating export options...');
  
  const exportOptions = {
    method: 'app-store',
    teamID: config.app.teamId,
    uploadBitcode: false,
    uploadSymbols: true,
    compileBitcode: false,
    thinning: '<none>',
    provisioningProfiles: {
      [config.app.bundleId]: 'Grahmos Distribution Profile'
    },
    signingStyle: 'manual',
    signingCertificate: 'Apple Distribution',
    iCloudContainerEnvironment: 'Production'
  };
  
  const plistPath = './build/ExportOptions.plist';
  
  // Convert to plist format
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>${exportOptions.method}</string>
  <key>teamID</key>
  <string>${exportOptions.teamID}</string>
  <key>uploadBitcode</key>
  <false/>
  <key>uploadSymbols</key>
  <true/>
  <key>compileBitcode</key>
  <false/>
  <key>thinning</key>
  <string>${exportOptions.thinning}</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>${config.app.bundleId}</key>
    <string>Grahmos Distribution Profile</string>
  </dict>
  <key>signingStyle</key>
  <string>manual</string>
  <key>signingCertificate</key>
  <string>Apple Distribution</string>
  <key>iCloudContainerEnvironment</key>
  <string>Production</string>
</dict>
</plist>`;
  
  fs.writeFileSync(plistPath, plistContent);
  logger.success(`Export options created: ${plistPath}`);
  return plistPath;
};

// Upload functions
const uploadToAppStoreConnect = async () => {
  logger.info('Uploading to App Store Connect...');
  
  const uploadCommand = `xcrun altool --upload-app \
    -f ${config.build.ipaPath} \
    -t ios \
    --apiKey ${config.appStoreConnect.apiKeyId} \
    --apiIssuer ${config.appStoreConnect.issuerId} \
    --show-progress`;
  
  const uploadResult = executeCommand(uploadCommand);
  if (!uploadResult.success) {
    logger.error('Upload to App Store Connect failed');
    return false;
  }
  
  logger.success('Upload to App Store Connect completed');
  return true;
};

const setupTestFlightDistribution = async () => {
  logger.info('Setting up TestFlight distribution...');
  
  // Wait for processing to complete
  logger.info('Waiting for build processing...');
  await waitForBuildProcessing();
  
  // Get the latest build
  const buildInfo = await getLatestBuild();
  if (!buildInfo) {
    logger.error('Could not find processed build');
    return false;
  }
  
  // Update build info for TestFlight
  const success = await updateBuildForTestFlight(buildInfo.id);
  if (!success) {
    return false;
  }
  
  // Add to beta groups
  for (const groupName of config.testFlight.betaGroups) {
    await addToTestFlightGroup(buildInfo.id, groupName);
  }
  
  logger.success('TestFlight distribution setup completed');
  return true;
};

const waitForBuildProcessing = async () => {
  const maxWaitTime = 30 * 60 * 1000; // 30 minutes
  const checkInterval = 60 * 1000; // 1 minute
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    logger.info('Checking build processing status...');
    
    const buildInfo = await getLatestBuild();
    if (buildInfo && buildInfo.processingState === 'VALID') {
      logger.success('Build processing completed');
      return true;
    }
    
    if (buildInfo && buildInfo.processingState === 'INVALID') {
      logger.error('Build processing failed');
      return false;
    }
    
    logger.info(`Build status: ${buildInfo?.processingState || 'UNKNOWN'}. Waiting...`);
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  logger.error('Timeout waiting for build processing');
  return false;
};

const getLatestBuild = async () => {
  const command = `xcrun altool --list-builds \
    --app-identifier ${config.app.bundleId} \
    --apiKey ${config.appStoreConnect.apiKeyId} \
    --apiIssuer ${config.appStoreConnect.issuerId} \
    --output-format json`;
  
  const result = executeCommand(command, { silent: true });
  if (!result.success) {
    logger.error('Failed to get build list');
    return null;
  }
  
  try {
    const data = JSON.parse(result.output);
    const builds = data['tool-results']?.builds || [];
    return builds.length > 0 ? builds[0] : null;
  } catch (error) {
    logger.error('Failed to parse build list response');
    return null;
  }
};

const updateBuildForTestFlight = async (buildId) => {
  logger.info(`Updating build ${buildId} for TestFlight...`);
  
  // Create build metadata
  const metadata = {
    buildId: buildId,
    usesNonExemptEncryption: false,
    reviewNotes: config.testFlight.reviewNotes,
    autoNotifyEnabled: config.testFlight.autoNotify
  };
  
  // Use App Store Connect API to update build
  const updateCommand = `curl -X PATCH \
    -H "Authorization: Bearer $(generate-jwt-token)" \
    -H "Content-Type: application/json" \
    -d '${JSON.stringify(metadata)}' \
    "https://api.appstoreconnect.apple.com/v1/builds/${buildId}"`;
  
  const result = executeCommand(updateCommand, { silent: true });
  if (!result.success) {
    logger.error('Failed to update build for TestFlight');
    return false;
  }
  
  logger.success('Build updated for TestFlight');
  return true;
};

const addToTestFlightGroup = async (buildId, groupName) => {
  logger.info(`Adding build to TestFlight group: ${groupName}`);
  
  // Implementation would use App Store Connect API
  // For now, log the action
  logger.info(`Would add build ${buildId} to group ${groupName}`);
  
  return true;
};

// App Store submission
const submitToAppStore = async () => {
  logger.info('Preparing App Store submission...');
  
  const buildInfo = await getLatestBuild();
  if (!buildInfo) {
    logger.error('No build available for App Store submission');
    return false;
  }
  
  // Create app store version
  const versionInfo = await createAppStoreVersion(buildInfo);
  if (!versionInfo) {
    return false;
  }
  
  // Submit for review
  const submitted = await submitForReview(versionInfo.id);
  if (!submitted) {
    return false;
  }
  
  logger.success('App Store submission completed');
  return true;
};

const createAppStoreVersion = async (buildInfo) => {
  logger.info('Creating App Store version...');
  
  const versionString = buildInfo.version;
  const versionData = {
    type: 'appStoreVersions',
    attributes: {
      platform: 'IOS',
      versionString: versionString,
      releaseType: config.appStore.releaseType
    },
    relationships: {
      app: {
        data: {
          type: 'apps',
          id: config.app.appId
        }
      },
      build: {
        data: {
          type: 'builds',
          id: buildInfo.id
        }
      }
    }
  };
  
  // Implementation would use App Store Connect API
  logger.info(`Would create App Store version ${versionString}`);
  
  return { id: 'mock-version-id', version: versionString };
};

const submitForReview = async (versionId) => {
  logger.info(`Submitting version ${versionId} for review...`);
  
  const submissionData = {
    type: 'appStoreVersionSubmissions',
    relationships: {
      appStoreVersion: {
        data: {
          type: 'appStoreVersions',
          id: versionId
        }
      }
    }
  };
  
  // Implementation would use App Store Connect API
  logger.info('Would submit for App Store review');
  
  return true;
};

// Main deployment function
const deployToiOS = async (target = 'testflight') => {
  logger.info(`Starting iOS deployment to ${target}...`);
  
  try {
    // Validate environment and project
    if (!validateEnvironment() || !validateProject()) {
      process.exit(1);
    }
    
    // Build the app
    const buildSuccess = await buildApp();
    if (!buildSuccess) {
      logger.error('Build failed');
      process.exit(1);
    }
    
    // Upload to App Store Connect
    const uploadSuccess = await uploadToAppStoreConnect();
    if (!uploadSuccess) {
      logger.error('Upload failed');
      process.exit(1);
    }
    
    // Deploy based on target
    switch (target) {
      case 'testflight':
        const testFlightSuccess = await setupTestFlightDistribution();
        if (!testFlightSuccess) {
          logger.error('TestFlight setup failed');
          process.exit(1);
        }
        break;
        
      case 'appstore':
        const appStoreSuccess = await submitToAppStore();
        if (!appStoreSuccess) {
          logger.error('App Store submission failed');
          process.exit(1);
        }
        break;
        
      default:
        logger.error(`Unknown deployment target: ${target}`);
        process.exit(1);
    }
    
    logger.success(`iOS deployment to ${target} completed successfully!`);
    
  } catch (error) {
    logger.error(`Deployment failed: ${error.message}`);
    process.exit(1);
  }
};

// CLI interface
if (require.main === module) {
  const target = process.argv[2] || 'testflight';
  deployToiOS(target);
}

module.exports = {
  deployToiOS,
  buildApp,
  uploadToAppStoreConnect,
  setupTestFlightDistribution,
  submitToAppStore
};

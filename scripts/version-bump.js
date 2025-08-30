#!/usr/bin/env node

/**
 * Version Bump Script for Grahmos
 * Coordinates version updates across all packages and generates changelog
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class VersionManager {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.version = null;
    this.bumpType = process.argv[2] || 'patch';
    this.channel = process.argv[3] || 'latest';
  }

  async run() {
    try {
      console.log('🚀 Grahmos Version Bump Script');
      console.log(`📦 Bump type: ${this.bumpType}`);
      console.log(`🌟 Release channel: ${this.channel}`);
      console.log();

      await this.validateBumpType();
      await this.getCurrentVersion();
      await this.calculateNewVersion();
      await this.updateAllPackages();
      await this.generateChangelog();
      await this.createGitTag();
      
      console.log('✅ Version bump completed successfully!');
      console.log(`🎉 New version: ${this.version}`);
      console.log();
      console.log('Next steps:');
      console.log('1. Review the changes: git diff');
      console.log('2. Commit the changes: git commit -am "Release v' + this.version + '"');
      console.log('3. Push the tag: git push origin v' + this.version);
      console.log('4. The CI/CD pipeline will handle the rest!');

    } catch (error) {
      console.error('❌ Version bump failed:', error.message);
      process.exit(1);
    }
  }

  async validateBumpType() {
    const validTypes = ['patch', 'minor', 'major', 'prerelease'];
    if (!validTypes.includes(this.bumpType)) {
      throw new Error(`Invalid bump type: ${this.bumpType}. Must be one of: ${validTypes.join(', ')}`);
    }
  }

  async getCurrentVersion() {
    const rootPackagePath = path.join(this.rootDir, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(rootPackagePath, 'utf8'));
      this.currentVersion = packageJson.version || '2.0.0';
    } catch (error) {
      console.warn('Root package.json not found, using default version 2.0.0');
      this.currentVersion = '2.0.0';
    }
    
    console.log(`📋 Current version: ${this.currentVersion}`);
  }

  async calculateNewVersion() {
    const parts = this.currentVersion.split('.').map(Number);
    let [major, minor, patch] = parts;

    switch (this.bumpType) {
      case 'major':
        major += 1;
        minor = 0;
        patch = 0;
        break;
      case 'minor':
        minor += 1;
        patch = 0;
        break;
      case 'patch':
        patch += 1;
        break;
      case 'prerelease':
        if (this.channel === 'beta') {
          patch += 1;
          this.version = `${major}.${minor}.${patch}-beta.${Date.now()}`;
          return;
        } else {
          patch += 1;
        }
        break;
    }

    this.version = `${major}.${minor}.${patch}`;
    console.log(`📈 New version: ${this.version}`);
  }

  async updateAllPackages() {
    console.log('📝 Updating package versions...');
    
    const packages = [
      'package.json',
      'installer/package.json',
      'apps/pwa-shell/package.json',
      'apps/edge-api/package.json',
      'apps/edge-functions/package.json',
      'packages/assistant/package.json',
      'packages/p2p-delta/package.json',
      'packages/crypto-verify/package.json',
      'packages/local-db/package.json',
      'packages/search-core/package.json'
    ];

    for (const packagePath of packages) {
      await this.updatePackageVersion(packagePath);
    }

    // Update version in Electron main process
    await this.updateElectronVersion();
    
    // Update version in CI/CD workflows
    await this.updateWorkflowVersions();
  }

  async updatePackageVersion(packagePath) {
    const fullPath = path.join(this.rootDir, packagePath);
    
    try {
      const exists = await fs.access(fullPath).then(() => true).catch(() => false);
      if (!exists) {
        console.log(`⏭️  Skipping ${packagePath} (not found)`);
        return;
      }

      const content = await fs.readFile(fullPath, 'utf8');
      const packageJson = JSON.parse(content);
      
      packageJson.version = this.version;
      
      await fs.writeFile(fullPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log(`✅ Updated ${packagePath}`);
      
    } catch (error) {
      console.warn(`⚠️  Failed to update ${packagePath}:`, error.message);
    }
  }

  async updateElectronVersion() {
    const mainPath = path.join(this.rootDir, 'installer/src/main.js');
    
    try {
      let content = await fs.readFile(mainPath, 'utf8');
      
      // Update version logging
      content = content.replace(
        /log\.info\(`App version: \$\{app\.getVersion\(\)\}`\);/,
        `log.info(\`App version: \${app.getVersion()} (${this.version})\`);`
      );
      
      await fs.writeFile(mainPath, content);
      console.log('✅ Updated Electron main process');
      
    } catch (error) {
      console.warn('⚠️  Failed to update Electron version:', error.message);
    }
  }

  async updateWorkflowVersions() {
    const workflowFiles = [
      '.github/workflows/desktop-release.yml',
      '.github/workflows/enhanced-ci-cd.yml'
    ];

    for (const workflowPath of workflowFiles) {
      await this.updateWorkflowVersion(workflowPath);
    }
  }

  async updateWorkflowVersion(workflowPath) {
    const fullPath = path.join(this.rootDir, workflowPath);
    
    try {
      const exists = await fs.access(fullPath).then(() => true).catch(() => false);
      if (!exists) {
        console.log(`⏭️  Skipping ${workflowPath} (not found)`);
        return;
      }

      let content = await fs.readFile(fullPath, 'utf8');
      
      // Update GRAHMOS_VERSION environment variable
      content = content.replace(
        /GRAHMOS_VERSION:\s*[\d\.-]+/g,
        `GRAHMOS_VERSION: ${this.version}`
      );
      
      // Update VERSION environment variable
      content = content.replace(
        /VERSION:\s*[\d\.-]+/g,
        `VERSION: ${this.version}`
      );
      
      await fs.writeFile(fullPath, content);
      console.log(`✅ Updated ${workflowPath}`);
      
    } catch (error) {
      console.warn(`⚠️  Failed to update ${workflowPath}:`, error.message);
    }
  }

  async generateChangelog() {
    console.log('📜 Generating changelog...');
    
    try {
      // Get git commits since last tag
      let commits;
      try {
        commits = execSync('git log --oneline --no-merges $(git describe --tags --abbrev=0)..HEAD', 
          { encoding: 'utf8', cwd: this.rootDir });
      } catch {
        // If no previous tags, get all commits
        commits = execSync('git log --oneline --no-merges', 
          { encoding: 'utf8', cwd: this.rootDir });
      }

      const changelogPath = path.join(this.rootDir, 'CHANGELOG.md');
      const today = new Date().toISOString().split('T')[0];
      
      // Parse commits into categories
      const changes = this.categorizeCommits(commits);
      
      // Generate changelog entry
      const entry = this.generateChangelogEntry(today, changes);
      
      // Prepend to existing changelog or create new one
      let existingChangelog = '';
      try {
        existingChangelog = await fs.readFile(changelogPath, 'utf8');
      } catch {
        existingChangelog = '# Changelog\n\nAll notable changes to Grahmos will be documented in this file.\n\n';
      }
      
      // Insert new entry after the header
      const lines = existingChangelog.split('\n');
      const headerEnd = lines.findIndex(line => line.startsWith('## '));
      
      if (headerEnd === -1) {
        // No existing entries, add after header
        lines.splice(3, 0, '', entry);
      } else {
        // Insert before first existing entry
        lines.splice(headerEnd, 0, entry, '');
      }
      
      await fs.writeFile(changelogPath, lines.join('\n'));
      console.log('✅ Updated CHANGELOG.md');
      
    } catch (error) {
      console.warn('⚠️  Failed to generate changelog:', error.message);
    }
  }

  categorizeCommits(commits) {
    const changes = {
      features: [],
      fixes: [],
      improvements: [],
      other: []
    };

    commits.split('\n').forEach(commit => {
      if (!commit.trim()) return;
      
      const [hash, ...messageParts] = commit.split(' ');
      const message = messageParts.join(' ');
      
      if (message.match(/^(feat|feature)[\(\:]|add|implement|new/i)) {
        changes.features.push(message);
      } else if (message.match(/^(fix|bug)[\(\:]|resolve|patch/i)) {
        changes.fixes.push(message);
      } else if (message.match(/^(improve|enhance|update|refactor|optimize)[\(\:]|better/i)) {
        changes.improvements.push(message);
      } else {
        changes.other.push(message);
      }
    });

    return changes;
  }

  generateChangelogEntry(date, changes) {
    let entry = `## [${this.version}] - ${date}\n`;
    
    if (changes.features.length > 0) {
      entry += '\n### ✨ New Features\n';
      changes.features.forEach(feature => {
        entry += `- ${feature}\n`;
      });
    }
    
    if (changes.improvements.length > 0) {
      entry += '\n### 🚀 Improvements\n';
      changes.improvements.forEach(improvement => {
        entry += `- ${improvement}\n`;
      });
    }
    
    if (changes.fixes.length > 0) {
      entry += '\n### 🐛 Bug Fixes\n';
      changes.fixes.forEach(fix => {
        entry += `- ${fix}\n`;
      });
    }
    
    if (changes.other.length > 0) {
      entry += '\n### 📦 Other Changes\n';
      changes.other.forEach(change => {
        entry += `- ${change}\n`;
      });
    }

    return entry;
  }

  async createGitTag() {
    console.log('🏷️  Creating git tag...');
    
    try {
      // Stage all changes
      execSync('git add .', { cwd: this.rootDir });
      
      // Create tag
      const tagName = `v${this.version}`;
      const tagMessage = `Release ${tagName}`;
      
      execSync(`git tag -a ${tagName} -m "${tagMessage}"`, { cwd: this.rootDir });
      console.log(`✅ Created tag: ${tagName}`);
      
    } catch (error) {
      console.warn('⚠️  Failed to create git tag:', error.message);
      console.log('💡 You can create the tag manually: git tag -a v' + this.version + ' -m "Release v' + this.version + '"');
    }
  }
}

// Run the version manager
const versionManager = new VersionManager();
versionManager.run();

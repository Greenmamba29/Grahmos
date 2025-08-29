#!/usr/bin/env node

/**
 * Update Manifest Generator for Grahmos Auto-Updates
 * Generates latest.yml and latest-mac.yml files for electron-updater
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class UpdateManifestGenerator {
  constructor() {
    this.version = process.argv[2] || '2.0.0';
    this.releaseDir = process.argv[3] || './release-assets';
    this.baseUrl = process.env.RELEASE_BASE_URL || 'https://github.com/grahmos/desktop/releases/download';
  }

  async run() {
    try {
      console.log('🚀 Generating auto-update manifests');
      console.log(`📦 Version: ${this.version}`);
      console.log(`📁 Release directory: ${this.releaseDir}`);
      console.log();

      const files = await this.findReleaseFiles();
      await this.generateWindowsManifest(files);
      await this.generateMacManifest(files);
      await this.generateLinuxManifest(files);
      
      console.log('✅ Update manifests generated successfully!');
    } catch (error) {
      console.error('❌ Failed to generate manifests:', error.message);
      process.exit(1);
    }
  }

  async findReleaseFiles() {
    const files = {};
    
    try {
      const entries = await fs.readdir(this.releaseDir);
      
      for (const file of entries) {
        const filePath = path.join(this.releaseDir, file);
        const stat = await fs.stat(filePath);
        
        if (!stat.isFile()) continue;
        
        // Categorize files by platform and type
        if (file.endsWith('.exe') && file.includes('Setup')) {
          files.windowsNsis = { name: file, path: filePath };
        } else if (file.endsWith('.exe') && !file.includes('Setup')) {
          files.windowsPortable = { name: file, path: filePath };
        } else if (file.endsWith('.dmg')) {
          files.macDmg = { name: file, path: filePath };
        } else if (file.endsWith('.zip') && file.includes('mac')) {
          files.macZip = { name: file, path: filePath };
        } else if (file.endsWith('.AppImage')) {
          files.linuxAppImage = { name: file, path: filePath };
        } else if (file.endsWith('.deb')) {
          files.linuxDeb = { name: file, path: filePath };
        }
      }
      
      console.log('📋 Found release files:');
      Object.entries(files).forEach(([key, file]) => {
        console.log(`  ${key}: ${file.name}`);
      });
      console.log();
      
      return files;
    } catch (error) {
      throw new Error(`Failed to read release directory: ${error.message}`);
    }
  }

  async generateFileInfo(filePath) {
    const stat = await fs.stat(filePath);
    const buffer = await fs.readFile(filePath);
    const sha512 = crypto.createHash('sha512').update(buffer).digest('base64');
    
    return {
      size: stat.size,
      sha512
    };
  }

  async generateWindowsManifest(files) {
    if (!files.windowsNsis && !files.windowsPortable) {
      console.log('⏭️  No Windows files found, skipping manifest');
      return;
    }

    const manifest = {
      version: this.version,
      files: [],
      path: '',
      sha512: '',
      releaseDate: new Date().toISOString()
    };

    // Prefer NSIS installer, fallback to portable
    const mainFile = files.windowsNsis || files.windowsPortable;
    const fileInfo = await this.generateFileInfo(mainFile.path);
    
    manifest.path = mainFile.name;
    manifest.sha512 = fileInfo.sha512;
    
    manifest.files.push({
      url: `${this.baseUrl}/v${this.version}/${mainFile.name}`,
      sha512: fileInfo.sha512,
      size: fileInfo.size,
      blockMapSize: Math.ceil(fileInfo.size / 4096) // Approximate
    });

    const yamlContent = this.objectToYaml(manifest);
    const outputPath = path.join(this.releaseDir, 'latest.yml');
    
    await fs.writeFile(outputPath, yamlContent);
    console.log('✅ Generated latest.yml for Windows');
  }

  async generateMacManifest(files) {
    if (!files.macDmg && !files.macZip) {
      console.log('⏭️  No macOS files found, skipping manifest');
      return;
    }

    const manifest = {
      version: this.version,
      files: [],
      path: '',
      sha512: '',
      releaseDate: new Date().toISOString()
    };

    // Prefer DMG, fallback to ZIP
    const mainFile = files.macDmg || files.macZip;
    const fileInfo = await this.generateFileInfo(mainFile.path);
    
    manifest.path = mainFile.name;
    manifest.sha512 = fileInfo.sha512;
    
    manifest.files.push({
      url: `${this.baseUrl}/v${this.version}/${mainFile.name}`,
      sha512: fileInfo.sha512,
      size: fileInfo.size
    });

    const yamlContent = this.objectToYaml(manifest);
    const outputPath = path.join(this.releaseDir, 'latest-mac.yml');
    
    await fs.writeFile(outputPath, yamlContent);
    console.log('✅ Generated latest-mac.yml for macOS');
  }

  async generateLinuxManifest(files) {
    if (!files.linuxAppImage) {
      console.log('⏭️  No Linux AppImage found, skipping manifest');
      return;
    }

    const manifest = {
      version: this.version,
      files: [],
      path: '',
      sha512: '',
      releaseDate: new Date().toISOString()
    };

    const fileInfo = await this.generateFileInfo(files.linuxAppImage.path);
    
    manifest.path = files.linuxAppImage.name;
    manifest.sha512 = fileInfo.sha512;
    
    manifest.files.push({
      url: `${this.baseUrl}/v${this.version}/${files.linuxAppImage.name}`,
      sha512: fileInfo.sha512,
      size: fileInfo.size
    });

    const yamlContent = this.objectToYaml(manifest);
    const outputPath = path.join(this.releaseDir, 'latest-linux.yml');
    
    await fs.writeFile(outputPath, yamlContent);
    console.log('✅ Generated latest-linux.yml for Linux');
  }

  objectToYaml(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    let yaml = '';
    
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          yaml += `${spaces}  - `;
          if (typeof item === 'object') {
            yaml += '\n' + this.objectToYaml(item, indent + 2);
          } else {
            yaml += `${item}\n`;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        yaml += `${spaces}${key}:\n`;
        yaml += this.objectToYaml(value, indent + 1);
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }
    
    return yaml;
  }
}

// Run the generator
const generator = new UpdateManifestGenerator();
generator.run();

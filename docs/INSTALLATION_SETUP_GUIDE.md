# Grahmos Complete Installation & Setup Guide

## 🚀 Welcome to Grahmos - Your Offline-First Emergency Response Platform

Grahmos represents a paradigm shift in emergency preparedness and response. Unlike traditional online-only platforms, Grahmos works **offline-first**, ensuring you have access to critical information and AI assistance even when networks fail during emergencies.

---

## 📋 System Requirements

### Desktop Requirements

#### Windows
- **OS**: Windows 10 (1903) or Windows 11
- **Architecture**: x64 or ARM64
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space (5GB for full offline data)
- **Network**: Internet connection for initial setup and updates

#### macOS
- **OS**: macOS 10.15 (Catalina) or later
- **Architecture**: Intel x64 or Apple Silicon (M1/M2)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space (5GB for full offline data)
- **Network**: Internet connection for initial setup and updates

#### Linux
- **OS**: Ubuntu 18.04+, Debian 10+, Fedora 32+, or equivalent
- **Architecture**: x64 or ARM64
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space (5GB for full offline data)
- **Network**: Internet connection for initial setup and updates

### Mobile Requirements

#### iOS
- **OS**: iOS 14.0 or later
- **Devices**: iPhone 8 and newer, iPad (6th generation) and newer
- **Storage**: 500MB free space (2GB for full offline data)
- **Network**: Internet connection for initial setup and updates

#### Android
- **OS**: Android 8.0 (API level 26) or later
- **RAM**: 3GB minimum, 4GB recommended
- **Storage**: 500MB free space (2GB for full offline data)
- **Network**: Internet connection for initial setup and updates

### Cloud/Server Requirements

#### Minimum Cloud Instance
- **CPU**: 2 vCPUs
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **Network**: 100Mbps bandwidth
- **OS**: Ubuntu 20.04 LTS or Docker-compatible OS

#### Recommended Cloud Instance
- **CPU**: 4 vCPUs
- **RAM**: 8GB
- **Storage**: 50GB SSD
- **Network**: 1Gbps bandwidth
- **OS**: Ubuntu 22.04 LTS

---

## 💻 Desktop Installation

### Option 1: Download Pre-built Installer (Recommended)

#### Windows
1. **Download the Installer**
   ```
   https://releases.grahmos.org/desktop/windows/GrahmosSetup-x64.exe
   ```

2. **Run the Installer**
   - Right-click the downloaded file
   - Select "Run as administrator"
   - Follow the installation wizard
   - Choose installation directory (default: `C:\Program Files\Grahmos`)

3. **Initial Setup**
   - Launch Grahmos from Start Menu
   - Complete the welcome wizard
   - Allow network permissions for updates
   - Download offline data pack (recommended)

#### macOS
1. **Download the Installer**
   ```
   https://releases.grahmos.org/desktop/macos/Grahmos-x64.dmg
   # or for Apple Silicon:
   https://releases.grahmos.org/desktop/macos/Grahmos-arm64.dmg
   ```

2. **Install the Application**
   - Open the downloaded DMG file
   - Drag Grahmos to Applications folder
   - Allow installation from unidentified developer if prompted
   - (System Preferences → Security & Privacy → Allow)

3. **Initial Setup**
   - Launch Grahmos from Applications
   - Complete the welcome wizard
   - Grant necessary permissions (location, notifications)
   - Download offline data pack (recommended)

#### Linux
1. **Download the Package**
   ```bash
   # For Debian/Ubuntu:
   wget https://releases.grahmos.org/desktop/linux/grahmos_1.0.0_amd64.deb
   
   # For Red Hat/Fedora:
   wget https://releases.grahmos.org/desktop/linux/grahmos-1.0.0.x86_64.rpm
   
   # For Arch Linux:
   wget https://releases.grahmos.org/desktop/linux/grahmos-1.0.0.pkg.tar.xz
   ```

2. **Install the Package**
   ```bash
   # Debian/Ubuntu:
   sudo dpkg -i grahmos_1.0.0_amd64.deb
   sudo apt-get install -f  # Fix dependencies if needed
   
   # Red Hat/Fedora:
   sudo rpm -i grahmos-1.0.0.x86_64.rpm
   # or
   sudo dnf install grahmos-1.0.0.x86_64.rpm
   
   # Arch Linux:
   sudo pacman -U grahmos-1.0.0.pkg.tar.xz
   ```

3. **Initial Setup**
   - Launch from application menu or run `grahmos` in terminal
   - Complete the welcome wizard
   - Download offline data pack (recommended)

### Option 2: Build from Source

1. **Prerequisites**
   ```bash
   # Install Node.js 20+
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install build tools
   sudo apt-get install -y build-essential git python3
   ```

2. **Clone and Build**
   ```bash
   git clone https://github.com/grahmos/grahmos.git
   cd grahmos
   npm install
   npm run build
   npm run build:desktop
   ```

3. **Install Built Package**
   ```bash
   # Find built package in dist/ directory
   sudo dpkg -i dist/grahmos_1.0.0_amd64.deb
   ```

---

## 📱 Mobile Installation

### iOS Installation

#### Option 1: App Store (Coming Soon)
1. Open the App Store
2. Search for "Grahmos Emergency"
3. Tap "Get" to install
4. Launch and complete setup

#### Option 2: TestFlight Beta
1. **Join Beta Program**
   - Visit: https://testflight.apple.com/join/grahmos-beta
   - Install TestFlight if not already installed
   - Accept invitation

2. **Install Beta Version**
   - Open TestFlight
   - Find Grahmos in your apps
   - Tap "Install"

3. **Setup**
   - Launch Grahmos
   - Allow location access
   - Allow notifications
   - Complete welcome wizard
   - Download offline data pack

### Android Installation

#### Option 1: Google Play Store (Coming Soon)
1. Open Google Play Store
2. Search for "Grahmos Emergency"
3. Tap "Install"
4. Launch and complete setup

#### Option 2: APK Installation
1. **Enable Unknown Sources**
   - Settings → Security → Unknown Sources → Enable
   - Or Settings → Apps → Special App Access → Install Unknown Apps

2. **Download and Install**
   ```
   https://releases.grahmos.org/mobile/android/grahmos-v1.0.0.apk
   ```
   - Download the APK file
   - Tap the downloaded file to install
   - Follow installation prompts

3. **Setup**
   - Launch Grahmos
   - Grant all requested permissions
   - Complete welcome wizard
   - Download offline data pack

#### Option 3: Build from Source
1. **Prerequisites**
   - Install Android Studio
   - Install React Native development environment
   - Set up Android SDK

2. **Build Process**
   ```bash
   git clone https://github.com/grahmos/grahmos.git
   cd grahmos/apps/mobile
   npm install
   npx react-native build-android
   ```

---

## ☁️ Cloud Deployment

### Option 1: Docker Deployment (Recommended)

#### Quick Start with Docker Compose
```bash
# Download deployment files
wget https://releases.grahmos.org/cloud/docker-compose.yml
wget https://releases.grahmos.org/cloud/.env.example
cp .env.example .env

# Configure environment variables
nano .env  # Edit with your settings

# Deploy
docker-compose up -d
```

#### Environment Configuration (.env)
```bash
# Basic Configuration
GRAHMOS_DOMAIN=yourdomain.com
GRAHMOS_EMAIL=admin@yourdomain.com

# Database Configuration
DATABASE_URL=postgresql://grahmos:password@postgres:5432/grahmos
REDIS_URL=redis://redis:6379

# AI/ML Configuration
OPENAI_API_KEY=your_openai_key
PINECONE_API_KEY=your_pinecone_key
PINECONE_ENVIRONMENT=production

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ADMIN_PASSWORD=secure_password

# Security
JWT_SECRET=your_super_secure_secret
ENCRYPTION_KEY=32_character_encryption_key

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### Option 2: Kubernetes Deployment

#### Prerequisites
```bash
# Install kubectl
curl -LO https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

#### Deploy with Helm Chart
```bash
# Add Grahmos Helm repository
helm repo add grahmos https://charts.grahmos.org
helm repo update

# Install Grahmos
helm install grahmos grahmos/grahmos \
  --set global.domain=yourdomain.com \
  --set global.email=admin@yourdomain.com \
  --set openai.apiKey=your_openai_key \
  --set pinecone.apiKey=your_pinecone_key
```

### Option 3: Manual Cloud Installation

#### Ubuntu 22.04 Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Install Redis
sudo apt-get install -y redis-server
sudo systemctl start redis
sudo systemctl enable redis

# Install Nginx
sudo apt-get install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Install Docker (for monitoring stack)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install PM2 for process management
sudo npm install -g pm2
```

#### Deploy Grahmos
```bash
# Clone repository
git clone https://github.com/grahmos/grahmos.git
cd grahmos

# Install dependencies
npm install

# Build applications
npm run build

# Configure environment
cp .env.example .env
nano .env  # Configure your settings

# Setup database
sudo -u postgres createdb grahmos
sudo -u postgres psql -c "CREATE USER grahmos WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE grahmos TO grahmos;"

# Run migrations
npm run db:migrate

# Start with PM2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

---

## 🎯 Initial Configuration & Setup

### Desktop Configuration

#### First Launch Wizard
1. **Welcome Screen**
   - Select your language
   - Accept terms of service
   - Choose installation type (Standard/Advanced)

2. **Location Settings**
   - Allow location access
   - Set home location
   - Define emergency contacts
   - Configure notification preferences

3. **Emergency Profile**
   - Personal information (name, age, medical conditions)
   - Emergency contacts (3-5 people)
   - Medical information (allergies, medications)
   - Special needs (mobility, dietary, etc.)

4. **Offline Data Setup**
   - Choose data pack size (Basic/Standard/Complete)
   - **Basic**: 500MB - Essential emergency info
   - **Standard**: 2GB - Full emergency database + local AI
   - **Complete**: 5GB - Everything + offline maps
   - Download progress will show

5. **Security Setup**
   - Create master password (optional but recommended)
   - Enable biometric authentication (if available)
   - Backup emergency data encryption key

#### Advanced Settings
```
Settings → Advanced Configuration

Network Settings:
- P2P Network: Enable/Disable
- Network Discovery: Auto/Manual
- Bandwidth Limits: Set upload/download limits
- Proxy Configuration: HTTP/SOCKS proxy support

AI Assistant:
- Response Style: Formal/Casual/Technical
- Language Model: GPT-4/Local Model
- Offline Mode: Enable local responses
- Voice Settings: Select TTS voice

Emergency Settings:
- Auto-Alert Contacts: Enable/Disable
- Location Sharing: Always/Emergency Only/Never
- Emergency Activation: Panic Button/Voice Command
- Recovery Mode: Automatic system recovery

Privacy Settings:
- Data Collection: Minimal/Standard/Enhanced
- Analytics: Enable/Disable
- Crash Reporting: Enable/Disable
- Local Data Encryption: Enable/Disable
```

### Mobile Configuration

#### Permission Setup
The app will request the following permissions:

1. **Location Services** (Required)
   - Purpose: Emergency location sharing and local alerts
   - Usage: Continuous background location for emergency detection

2. **Notifications** (Highly Recommended)
   - Purpose: Emergency alerts and system notifications
   - Usage: Critical emergency information delivery

3. **Microphone** (Optional)
   - Purpose: Voice commands and AI assistant
   - Usage: Voice activation of emergency features

4. **Camera** (Optional)
   - Purpose: Document damage and share situation
   - Usage: Visual emergency reporting

5. **Storage** (Required)
   - Purpose: Offline data and emergency information
   - Usage: Cache emergency data for offline access

#### Offline Data Configuration
```
Mobile Settings → Offline Data

Sync Settings:
- WiFi Only: Download only on WiFi
- Background Sync: Enable/Disable
- Auto-Update: Daily/Weekly/Manual
- Data Limit: Set maximum offline data size

Emergency Pack Selection:
- Essential Pack (100MB): Basic emergency info
- Standard Pack (500MB): Full emergency database
- Regional Pack (1GB): Local emergency services + maps
- Complete Pack (2GB): Everything including AI models
```

### Cloud Configuration

#### Environment Variables Setup
```bash
# Copy the comprehensive environment template
cp .env.production.template .env

# Essential configurations
GRAHMOS_DOMAIN=your-domain.com
GRAHMOS_SSL_EMAIL=admin@your-domain.com

# Database (Use managed service recommended)
DATABASE_URL=postgresql://username:password@host:5432/grahmos
DATABASE_POOL_SIZE=20
DATABASE_TIMEOUT=30000

# Redis Cache
REDIS_URL=redis://username:password@host:6379
REDIS_CLUSTER=false

# AI/ML Services
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-...
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=production
COHERE_API_KEY=... (optional)

# Monitoring & Observability
PROMETHEUS_ENABLED=true
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=secure_password
OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4317

# Security
JWT_SECRET=very-secure-random-string
ENCRYPTION_MASTER_KEY=32-character-key-for-data-encryption
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# Email Services (for notifications)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key

# External Integrations
WEATHER_API_KEY=your-weather-api-key
MAPS_API_KEY=your-maps-api-key
EMERGENCY_SERVICES_API=your-emergency-api-key
```

#### SSL/TLS Configuration
```bash
# Using Certbot for Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

#### Monitoring Setup
```bash
# Start monitoring stack
docker-compose -f monitoring/docker-compose.yml up -d

# Access Grafana
# http://yourdomain.com:3000
# Login: admin / [your_grafana_password]

# Import Grahmos dashboard
# Dashboard ID: 15847 (from grafana.com)
```

---

## 🤖 AI Agent Onboarding Scripts

### Desktop Onboarding Assistant

Our AI agent will guide new users through the onboarding process with contextual help:

```javascript
// Built-in AI Onboarding Prompts
const onboardingPrompts = {
  welcome: `
    Welcome to Grahmos! I'm your emergency preparedness assistant. 
    I'll help you set up your offline emergency response system.
    
    What makes Grahmos different:
    • Works WITHOUT internet during emergencies
    • AI assistance available offline
    • Peer-to-peer emergency communication
    • Comprehensive emergency database
    
    Shall we start with your emergency profile?
  `,
  
  locationSetup: `
    Let's set up your location settings. This helps me:
    • Provide local emergency information
    • Connect you with nearby emergency services
    • Share accurate location in emergencies
    
    Your location data stays on your device and is only shared when YOU choose.
  `,
  
  offlineData: `
    The magic of Grahmos is working offline when you need it most.
    
    I recommend the Standard Pack (2GB) which includes:
    • Complete emergency response database
    • Offline AI responses (that's me!)
    • Local maps and emergency services
    • First aid and survival guides
    
    This downloads once and works forever, even without internet!
  `,
  
  emergencyContacts: `
    Emergency contacts are crucial. I can automatically notify them during emergencies.
    
    Please add:
    • 3-5 trusted contacts
    • Include at least one local and one distant contact
    • Add their relationship to you
    • Their alternate contact methods
  `,
  
  privacyExplanation: `
    Your privacy matters, especially in emergencies:
    
    • All data stored locally on YOUR device
    • No cloud storage of personal information
    • Peer-to-peer sharing only when YOU approve
    • Encryption protects all sensitive data
    • You control what information is shared
  `
};
```

### Mobile Mindset Shift Guidance

```javascript
// Mobile onboarding specifically addresses the mindset shift
const mindsetShiftGuidance = {
  paradigmShift: `
    📱 Traditional apps need constant internet connection
    🌐 Grahmos works BEST when internet fails
    
    Think of Grahmos as your offline emergency companion:
    • Downloads emergency data once
    • AI assistant works without internet
    • Connects directly with nearby devices
    • Your emergency toolkit in your pocket
  `,
  
  batteryOptimization: `
    🔋 Battery management in emergencies is critical:
    
    I've optimized Grahmos to:
    • Use minimal battery in standby
    • Activate power-saving in emergency mode
    • Work for days on a single charge
    • Prioritize essential functions only
    
    Would you like me to enable battery optimization?
  `,
  
  offlineCapabilities: `
    🌐 Here's what works WITHOUT internet:
    
    ✅ AI assistant (me!) 
    ✅ Emergency database & guides
    ✅ Local maps and navigation
    ✅ First aid instructions
    ✅ Survival guides
    ✅ Emergency contact notification
    ✅ Peer-to-peer messaging
    ✅ Location sharing with contacts
    
    Pretty amazing, right?
  `
};
```

### Global Accessibility Onboarding

```javascript
// Addressing the digital divide and accessibility
const accessibilityOnboarding = {
  digitalInclusion: `
    Welcome! Grahmos is designed for EVERYONE:
    
    🌍 First time using emergency tech? Perfect!
    🌍 Limited internet access? We've got you covered!
    🌍 Smartphone new to you? I'll guide you through everything!
    
    This might be different from other apps - and that's the point.
    You don't need internet, technical skills, or expensive data plans.
  `,
  
  simplicityFirst: `
    I'll keep everything simple:
    
    • Large, clear buttons
    • Simple language
    • Voice guidance available
    • Step-by-step instructions
    • No confusing technical terms
    
    If anything is unclear, just ask me!
  `,
  
  languageSupport: `
    I can help you in multiple languages:
    
    Currently supported:
    • English, Spanish, French, German, Arabic
    • Hindi, Mandarin, Japanese, Portuguese
    • And more being added constantly
    
    What language would you prefer for our emergency information?
  `
};
```

---

## 🎓 User Education & Mindset Shift

### The Offline-First Revolution

**Traditional Emergency Apps:**
- ❌ Require constant internet
- ❌ Fail when networks are overwhelmed
- ❌ Depend on centralized servers
- ❌ Leave you stranded in real emergencies

**Grahmos Approach:**
- ✅ Works best offline
- ✅ Peer-to-peer emergency network
- ✅ AI assistance without internet
- ✅ Complete emergency database on device
- ✅ Becomes more reliable as more people use it

### Key Mindset Shifts

#### 1. "Download Once, Use Forever"
Unlike streaming apps, you download Grahmos data once and it works indefinitely without internet. Think of it like downloading a comprehensive emergency manual that includes an AI assistant.

#### 2. "Your Device Becomes the Hub"
Your phone/computer becomes a complete emergency response center. Other nearby devices can connect directly to yours, creating an instant emergency network.

#### 3. "Privacy Through Decentralization"
Instead of sending your data to company servers, everything stays on your device and connects directly with trusted contacts. More private AND more reliable.

#### 4. "Community-Powered, Not Corporate-Controlled"
The network gets stronger as more people join. It's powered by the community, not dependent on any single company's servers.

---

## 🆘 Emergency Activation Guide

### Quick Emergency Activation

#### Desktop
- **Panic Button**: Press F1 + F2 simultaneously
- **Voice Command**: "Hey Grahmos, this is an emergency"
- **Menu**: Click Emergency button in top-right corner

#### Mobile
- **Triple-tap**: Tap the Grahmos icon 3 times quickly
- **Voice Command**: "Hey Grahmos, emergency mode"
- **Widget**: Use the emergency widget on home screen
- **Volume Buttons**: Hold Volume Up + Volume Down for 3 seconds

### What Happens in Emergency Mode

1. **Immediate Actions**
   - Location shared with emergency contacts
   - Local emergency services notified (if enabled)
   - Device switches to power-saving mode
   - Emergency information displayed

2. **AI Assistant Activation**
   - Switches to emergency response mode
   - Provides step-by-step guidance
   - Offers first aid instructions
   - Suggests evacuation routes

3. **Network Activation**
   - Broadcasts emergency signal to nearby Grahmos users
   - Establishes mesh network for communication
   - Shares location with search and rescue if needed

---

## 🔧 Troubleshooting & Support

### Common Issues & Solutions

#### "App Won't Download Offline Data"
```bash
# Check available storage
Storage needed: 
- Basic Pack: 500MB
- Standard Pack: 2GB  
- Complete Pack: 5GB

Solution: Free up storage space or choose smaller pack
```

#### "AI Assistant Not Working Offline"
```bash
# Verify offline model download
Settings → AI Assistant → Check "Offline Model Status"
If not downloaded: Settings → Download Offline Models

Note: First download requires internet connection
```

#### "Location Services Not Working"
```bash
# Check permissions
Desktop: Settings → Privacy → Location → Allow
Mobile: Settings → Apps → Grahmos → Permissions → Location → Always

Emergency mode requires location access for safety
```

#### "Emergency Contacts Not Receiving Alerts"
```bash
# Verify contact information
Settings → Emergency Contacts → Test Contact
Check: Phone numbers, email addresses, messaging apps

Emergency alerts use multiple methods for reliability
```

### Getting Help

#### Built-in Help System
- **AI Assistant**: Ask any question anytime
- **Help Documentation**: Comprehensive offline guides
- **Video Tutorials**: Step-by-step visual guides
- **Emergency Scenarios**: Practice emergency procedures

#### Community Support
- **Community Forums**: https://community.grahmos.org
- **User Groups**: Local Grahmos user meetups
- **Training Sessions**: Free emergency preparedness training

#### Professional Support
- **Email Support**: support@grahmos.org
- **Emergency Hotline**: +1-800-GRAHMOS (24/7)
- **Enterprise Support**: enterprise@grahmos.org

---

## 🎉 Welcome to the Offline-First Future!

Congratulations! You've just joined a revolutionary approach to emergency preparedness. You're no longer dependent on fragile internet connections or overcrowded networks during disasters.

### Your Next Steps:
1. ✅ Download your offline emergency data pack
2. ✅ Set up emergency contacts
3. ✅ Practice using the AI assistant
4. ✅ Share Grahmos with friends and family
5. ✅ Join the community forum

### Remember:
- **You're not alone**: Join millions preparing for emergencies together
- **Every download helps**: You strengthen the network for everyone
- **Practice makes perfect**: Test features before you need them
- **Stay informed**: Regular updates improve everyone's safety

**Welcome to Grahmos - Where being offline means being prepared!** 🌟

---

*Installation Guide Version 1.0*  
*Updated: August 29, 2024*  
*Next Update: November 29, 2024*

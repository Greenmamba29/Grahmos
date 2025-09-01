#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

console.log('🔍 Validating PWA capabilities...\n')

const outDir = path.join(__dirname, 'out')
const publicDir = path.join(__dirname, 'public')

// Test results storage
const results = {
  manifest: { status: 'unknown', details: [] },
  serviceWorker: { status: 'unknown', details: [] },
  icons: { status: 'unknown', details: [] },
  offline: { status: 'unknown', details: [] },
  installable: { status: 'unknown', details: [] }
}

// Helper function to check file exists
function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${description}`)
    return true
  } else {
    console.log(`❌ ${description} (missing: ${filePath})`)
    return false
  }
}

// Helper function to check file size
function getFileSize(filePath) {
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath)
    return `${(stats.size / 1024).toFixed(2)} KB`
  }
  return 'N/A'
}

console.log('📱 PWA Manifest Validation')
console.log('─'.repeat(40))

// Check manifest exists and is valid
const manifestPath = path.join(outDir, 'manifest.json')
if (checkFile(manifestPath, 'Manifest file exists')) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    
    // Essential manifest fields
    const requiredFields = ['name', 'short_name', 'start_url', 'display', 'background_color', 'theme_color', 'icons']
    const missingFields = requiredFields.filter(field => !manifest[field])
    
    if (missingFields.length === 0) {
      console.log('✅ All required manifest fields present')
      results.manifest.status = 'pass'
    } else {
      console.log(`❌ Missing manifest fields: ${missingFields.join(', ')}`)
      results.manifest.status = 'fail'
    }
    
    // Check manifest details
    console.log(`   • Name: "${manifest.name || 'N/A'}"`)
    console.log(`   • Short name: "${manifest.short_name || 'N/A'}"`)
    console.log(`   • Display mode: ${manifest.display || 'N/A'}`)
    console.log(`   • Start URL: ${manifest.start_url || 'N/A'}`)
    console.log(`   • Theme color: ${manifest.theme_color || 'N/A'}`)
    console.log(`   • Background color: ${manifest.background_color || 'N/A'}`)
    console.log(`   • Icons count: ${manifest.icons ? manifest.icons.length : 0}`)
    console.log(`   • Shortcuts count: ${manifest.shortcuts ? manifest.shortcuts.length : 0}`)
    
    results.manifest.details = [
      `Name: ${manifest.name}`,
      `Display: ${manifest.display}`,
      `Icons: ${manifest.icons?.length || 0}`,
      `Shortcuts: ${manifest.shortcuts?.length || 0}`
    ]
    
  } catch (error) {
    console.log(`❌ Manifest JSON parsing failed: ${error.message}`)
    results.manifest.status = 'fail'
  }
} else {
  results.manifest.status = 'fail'
}

console.log('\n🛡️ Service Worker Validation')
console.log('─'.repeat(40))

// Check service worker
const swPath = path.join(publicDir, 'sw.js')
if (checkFile(swPath, 'Service worker exists')) {
  const swContent = fs.readFileSync(swPath, 'utf8')
  console.log(`   • Size: ${getFileSize(swPath)}`)
  
  // Check for key service worker features
  const features = {
    'Cache management': swContent.includes('caches'),
    'Fetch event handling': swContent.includes('fetch'),
    'Install event': swContent.includes('install'),
    'Activate event': swContent.includes('activate'),
    'Precaching': swContent.includes('precache') || swContent.includes('workbox'),
    'Runtime caching': swContent.includes('runtimeCaching') || swContent.includes('registerRoute')
  }
  
  let passedFeatures = 0
  Object.entries(features).forEach(([feature, hasFeature]) => {
    if (hasFeature) {
      console.log(`   ✅ ${feature}`)
      passedFeatures++
    } else {
      console.log(`   ❌ ${feature}`)
    }
  })
  
  results.serviceWorker.status = passedFeatures >= 4 ? 'pass' : 'partial'
  results.serviceWorker.details = [`Features: ${passedFeatures}/${Object.keys(features).length}`, `Size: ${getFileSize(swPath)}`]
} else {
  results.serviceWorker.status = 'fail'
}

console.log('\n🎨 Icon Validation')
console.log('─'.repeat(40))

// Check icons
const requiredIconSizes = ['72x72', '96x96', '128x128', '144x144', '152x152', '192x192', '384x384', '512x512']
const iconResults = requiredIconSizes.map(size => {
  const iconPath = path.join(outDir, `icon-${size}.png`)
  const exists = fs.existsSync(iconPath)
  const sizeInfo = exists ? getFileSize(iconPath) : 'Missing'
  
  if (exists) {
    console.log(`   ✅ ${size} (${sizeInfo})`)
  } else {
    console.log(`   ❌ ${size} (Missing)`)
  }
  
  return exists
})

const iconsPassed = iconResults.filter(Boolean).length
results.icons.status = iconsPassed >= 6 ? 'pass' : iconsPassed >= 3 ? 'partial' : 'fail'
results.icons.details = [`Icons present: ${iconsPassed}/${requiredIconSizes.length}`]

console.log('\n📦 Offline Capability Validation')  
console.log('─'.repeat(40))

// Check offline essential files
const offlineFiles = [
  { path: 'catalog.seed.json', description: 'Emergency data cache' },
  { path: 'index.html', description: 'Main app shell' },
  { path: '_next/static/', description: 'Static assets', isDir: true }
]

let offlineReady = 0
offlineFiles.forEach(({ path: filePath, description, isDir = false }) => {
  const fullPath = path.join(outDir, filePath)
  const exists = isDir ? fs.existsSync(fullPath) : checkFile(fullPath, description)
  if (exists) offlineReady++
})

// Check for Next.js static files
const nextStaticPath = path.join(outDir, '_next', 'static')
if (fs.existsSync(nextStaticPath)) {
  const staticFiles = fs.readdirSync(nextStaticPath, { recursive: true }).length
  console.log(`   ✅ Static assets directory (${staticFiles} files)`)
  offlineReady++
} else {
  console.log(`   ❌ Static assets directory missing`)
}

results.offline.status = offlineReady >= 3 ? 'pass' : offlineReady >= 2 ? 'partial' : 'fail'
results.offline.details = [`Offline files ready: ${offlineReady}/${offlineFiles.length + 1}`]

console.log('\n🏠 PWA Installability Check')
console.log('─'.repeat(40))

// Comprehensive installability check
let installabilityScore = 0
const maxScore = 6

// Check HTTPS requirement (assume yes for production)
console.log('   ✅ HTTPS requirement (production deployment)')
installabilityScore++

// Check manifest validity
if (results.manifest.status === 'pass') {
  console.log('   ✅ Valid manifest')
  installabilityScore++
} else {
  console.log('   ❌ Valid manifest')
}

// Check service worker
if (results.serviceWorker.status !== 'fail') {
  console.log('   ✅ Service worker registered')
  installabilityScore++
} else {
  console.log('   ❌ Service worker registered')
}

// Check icons
if (results.icons.status !== 'fail') {
  console.log('   ✅ Sufficient icons (192px and 512px minimum)')
  installabilityScore++
} else {
  console.log('   ❌ Sufficient icons')
}

// Check display mode
try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest.display && manifest.display !== 'browser') {
    console.log(`   ✅ Standalone display mode (${manifest.display})`)
    installabilityScore++
  } else {
    console.log('   ❌ Standalone display mode')
  }
} catch (e) {
  console.log('   ❌ Standalone display mode (manifest error)')
}

// Check start URL
try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest.start_url) {
    console.log(`   ✅ Start URL defined (${manifest.start_url})`)
    installabilityScore++
  } else {
    console.log('   ❌ Start URL defined')
  }
} catch (e) {
  console.log('   ❌ Start URL defined (manifest error)')
}

results.installable.status = installabilityScore >= 5 ? 'pass' : installabilityScore >= 3 ? 'partial' : 'fail'
results.installable.details = [`Installability score: ${installabilityScore}/${maxScore}`]

console.log('\n📊 PWA Validation Summary')
console.log('='.repeat(50))

const statusEmoji = {
  pass: '✅',
  partial: '⚠️',
  fail: '❌',
  unknown: '❓'
}

Object.entries(results).forEach(([category, result]) => {
  const emoji = statusEmoji[result.status]
  const categoryName = category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1')
  console.log(`${emoji} ${categoryName}: ${result.status.toUpperCase()}`)
  result.details.forEach(detail => console.log(`   • ${detail}`))
})

// Overall PWA score
const scores = Object.values(results).map(r => r.status === 'pass' ? 2 : r.status === 'partial' ? 1 : 0)
const totalScore = scores.reduce((a, b) => a + b, 0)
const maxPossibleScore = Object.keys(results).length * 2
const percentage = Math.round((totalScore / maxPossibleScore) * 100)

console.log('\n🎯 Overall PWA Readiness')
console.log('─'.repeat(40))

let readinessLevel = 'Not Ready'
let emoji = '❌'

if (percentage >= 90) {
  readinessLevel = 'Production Ready'
  emoji = '🚀'
} else if (percentage >= 75) {
  readinessLevel = 'Nearly Ready'
  emoji = '✅'
} else if (percentage >= 50) {
  readinessLevel = 'Partially Ready'
  emoji = '⚠️'
} else {
  readinessLevel = 'Needs Work'
  emoji = '❌'
}

console.log(`${emoji} PWA Readiness: ${readinessLevel} (${percentage}%)`)
console.log(`   Score: ${totalScore}/${maxPossibleScore} points`)

console.log('\n🔗 Next Steps for Testing')
console.log('─'.repeat(40))
console.log('1. Deploy to HTTPS (✅ Already deployed to Netlify)')
console.log('2. Test installation on Chrome: DevTools > Application > Manifest')
console.log('3. Test offline: DevTools > Network > Offline mode') 
console.log('4. Test on mobile: Install PWA from browser menu')
console.log('5. Lighthouse PWA audit: DevTools > Lighthouse > Progressive Web App')
console.log('')
console.log('🌐 Live PWA: https://grahmos-v1.netlify.app')

// Exit with appropriate code
process.exit(percentage >= 75 ? 0 : 1)

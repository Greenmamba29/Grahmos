#!/usr/bin/env node

/**
 * Test script for GPT-OSS semantic search integration
 * Usage: node scripts/test-semantic-search.js
 */

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('🔍 Testing GPT-OSS Semantic Search Integration...\n')

async function testSemanticSearch() {
  try {
    console.log('📦 Testing package imports...')
    
    // Test if we can import the semantic search package
    try {
      const { initSemanticSearch, semanticSearch, getSemanticSearchStatus } = await import('../packages/gpt-oss-search/src/index.ts')
      console.log('✅ Successfully imported gpt-oss-search package')
      
      // Test initialization
      console.log('\n🚀 Testing semantic search initialization...')
      await initSemanticSearch({
        model_size: 'gpt-oss-20b',
        enable_streaming: true,
        enable_p2p_broadcast: false, // Disable P2P for testing
        cache_ttl: 60
      })
      
      const status = getSemanticSearchStatus()
      console.log('📊 Semantic search status:', status)
      
      if (status.initialized) {
        console.log('✅ Semantic search engine initialized successfully')
        
        // Test a simple search
        console.log('\n🔍 Testing semantic search query...')
        const testQuery = 'earthquake safety procedures'
        
        const results = await semanticSearch(testQuery, {
          reasoning_effort: 'medium',
          max_results: 5
        })
        
        console.log(`📋 Search results for "${testQuery}":`)
        console.log(`   - Found ${results.results.length} results`)
        console.log(`   - Processing time: ${results.total_processing_time}ms`)
        console.log(`   - Cache hit: ${results.cache_hit}`)
        console.log(`   - Summary: ${results.semantic_summary.substring(0, 100)}...`)
        
        // Test streaming search
        console.log('\n🌊 Testing streaming semantic search...')
        const { semanticSearchStream } = await import('../packages/gpt-oss-search/src/index.ts')
        
        let streamCount = 0
        for await (const result of semanticSearchStream('fire safety', {
          reasoning_effort: 'low',
          max_results: 3
        })) {
          streamCount++
          console.log(`   - Streamed result ${streamCount}: ${result.title}`)
          if (streamCount >= 2) break // Limit for testing
        }
        
        console.log('✅ Streaming search working correctly')
        
      } else {
        console.log('⚠️ Semantic search engine not initialized properly')
      }
      
    } catch (importError) {
      console.log('❌ Failed to import semantic search package:')
      console.log('   Error:', importError.message)
      
      // Check if it's a missing dependency issue
      if (importError.message.includes('Cannot resolve module')) {
        console.log('\n💡 Possible solutions:')
        console.log('   1. Run: pnpm install')
        console.log('   2. Check if gpt-oss package is available')
        console.log('   3. Verify workspace configuration')
      }
    }
    
    console.log('\n📦 Testing base search-core integration...')
    try {
      const { search, initIndex } = await import('../packages/search-core/src/index.ts')
      await initIndex()
      
      const baseResults = await search('emergency', { limit: 3 })
      console.log(`✅ Base search working: ${baseResults.length} results found`)
      
    } catch (baseError) {
      console.log('❌ Base search-core issue:', baseError.message)
    }
    
    console.log('\n📦 Testing AI search integration...')
    try {
      const { aiSearch, initAISearch } = await import('../packages/ai-search/src/index.ts')
      await initAISearch()
      
      const aiResults = await aiSearch('fire safety', { limit: 2 })
      console.log(`✅ AI search working: ${aiResults.results.length} results found`)
      
    } catch (aiError) {
      console.log('❌ AI search issue:', aiError.message)
    }
    
  } catch (error) {
    console.log('❌ Test failed with error:', error.message)
    console.log('\nStack trace:', error.stack)
  }
}

async function testFrontendIntegration() {
  console.log('\n🖥️ Testing frontend integration...')
  
  // Check if SemanticSearchConsole component exists
  const componentPath = join(__dirname, '../apps/pwa-shell/src/components/SemanticSearchConsole.tsx')
  try {
    const fs = await import('fs')
    if (fs.existsSync(componentPath)) {
      console.log('✅ SemanticSearchConsole component found')
      
      // Check key imports in the component
      const componentContent = fs.readFileSync(componentPath, 'utf-8')
      if (componentContent.includes('gpt-oss-search')) {
        console.log('✅ Component properly imports gpt-oss-search')
      } else {
        console.log('⚠️ Component missing gpt-oss-search import')
      }
      
      if (componentContent.includes('SemanticSearchResponse')) {
        console.log('✅ Component uses semantic search types')
      }
      
    } else {
      console.log('❌ SemanticSearchConsole component not found')
    }
  } catch (fsError) {
    console.log('⚠️ Could not check frontend files:', fsError.message)
  }
}

async function testBuildConfiguration() {
  console.log('\n⚙️ Testing build configuration...')
  
  try {
    const fs = await import('fs')
    
    // Check root package.json includes GPT-OSS dependencies
    const rootPackage = JSON.parse(fs.readFileSync(join(__dirname, '../package.json'), 'utf-8'))
    if (rootPackage.dependencies['gpt-oss']) {
      console.log('✅ Root package.json includes gpt-oss dependency')
    } else {
      console.log('⚠️ Root package.json missing gpt-oss dependency')
    }
    
    // Check PWA shell includes gpt-oss-search
    const pwaPackage = JSON.parse(fs.readFileSync(join(__dirname, '../apps/pwa-shell/package.json'), 'utf-8'))
    if (pwaPackage.dependencies['gpt-oss-search']) {
      console.log('✅ PWA shell includes gpt-oss-search workspace dependency')
    } else {
      console.log('⚠️ PWA shell missing gpt-oss-search dependency')
    }
    
    // Check turbo.json configuration
    if (fs.existsSync(join(__dirname, '../turbo.json'))) {
      console.log('✅ Turbo configuration file exists')
    }
    
  } catch (configError) {
    console.log('❌ Build configuration issue:', configError.message)
  }
}

// Run all tests
async function runTests() {
  console.log('🧪 GPT-OSS Semantic Search Integration Test Suite')
  console.log('=' .repeat(60))
  
  await testBuildConfiguration()
  await testSemanticSearch()
  await testFrontendIntegration()
  
  console.log('\n' + '='.repeat(60))
  console.log('🏁 Test suite completed!')
  console.log('\n💡 Next steps:')
  console.log('   1. Run: pnpm install (to install new dependencies)')
  console.log('   2. Run: pnpm dev (to start development servers)')
  console.log('   3. Visit: http://localhost:3000/search (to test UI)')
  console.log('   4. Check console for any runtime errors')
}

runTests().catch(console.error)
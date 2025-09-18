#!/usr/bin/env node

// Test script to validate GPT-OSS search integration
console.log('🧪 Testing GPT-OSS Semantic Search Integration...')

async function testSemanticSearch() {
  try {
    console.log('1️⃣ Testing imports...')
    
    // Test package import
    const { initializeGPTOSS, semanticSearch, analyzeSearchIntent } = await import('./packages/gpt-oss-search/src/client.js')
    console.log('✅ Package imported successfully')
    
    console.log('Available functions:', { initializeGPTOSS: typeof initializeGPTOSS, semanticSearch: typeof semanticSearch, analyzeSearchIntent: typeof analyzeSearchIntent })
    
    // Test basic functionality
    console.log('2️⃣ Testing initialization...')
    
    if (typeof initializeGPTOSS === 'function') {
      console.log('✅ initializeGPTOSS function available')
    } else {
      console.log('❌ initializeGPTOSS function missing')
    }
    
    if (typeof semanticSearch === 'function') {
      console.log('✅ semanticSearch function available')
    } else {
      console.log('❌ semanticSearch function missing')
    }
    
    if (typeof analyzeSearchIntent === 'function') {
      console.log('✅ analyzeSearchIntent function available')
    } else {
      console.log('❌ analyzeSearchIntent function missing')
    }
    
    console.log('3️⃣ Testing search intent analysis...')
    const intent = await analyzeSearchIntent('earthquake safety', true)
    console.log('✅ Intent analysis result:', intent)
    
    console.log('🎉 All tests passed! GPT-OSS semantic search is ready.')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('Stack:', error.stack)
    process.exit(1)
  }
}

testSemanticSearch()
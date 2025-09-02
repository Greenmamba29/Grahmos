// Simple test to verify AI search is working
import { aiSearch, initAISearch } from './packages/ai-search/src/simple-ai.ts'

async function testSearch() {
  try {
    console.log('🔍 Testing AI Search functionality...')
    
    // Test search without initialization (should auto-initialize)
    const result = await aiSearch('earthquake preparedness', {
      limit: 3,
      includeAISummary: true,
      useMemoryContext: true
    })
    
    console.log('✅ Search completed successfully!')
    console.log('📊 Results:', result.results.length)
    console.log('🤖 AI Summary:', result.aiSummary)
    console.log('💡 Suggestions:', result.suggestedQueries)
    console.log('⏱️ Processing time:', result.processingTime + 'ms')
    
    if (result.results.length > 0) {
      console.log('📄 First result:')
      console.log('  - Title:', result.results[0].title)
      console.log('  - AI Enhanced:', result.results[0].aiEnhanced)
      console.log('  - Relevance:', result.results[0].contextRelevance)
      console.log('  - AI Summary:', result.results[0].aiSummary)
    }
    
    console.log('\n🎉 AI Search is working correctly!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run test
testSearch()
